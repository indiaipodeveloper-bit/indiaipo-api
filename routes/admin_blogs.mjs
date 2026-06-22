import express from 'express';
import pool from '../db.mjs';
import { uploadFile } from '../helpers/uploadHelper.mjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Get all blogs (with pagination and basic fields to keep payload small)
router.get('/', async (req, res) => {
    try {
        let isAdmin = false;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const JWT_SECRET = process.env.JWT_SECRET || 'Indiaipo@123';
                const decoded = jwt.verify(token, JWT_SECRET);
                const userRole = (decoded.role || '').toLowerCase();
                if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'super admin') {
                    isAdmin = true;
                }
            }
        } catch (e) {
            // Ignore token errors, treat as public
        }

        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        
        // Capping limit for public users to prevent data scraping
        if (!isAdmin && limit > 50) {
            limit = 50;
        }

        const offset = (page - 1) * limit;

        // Optional filtering
        const { category, upcoming, status, search } = req.query;
        let whereClauses = [];
        let params = [];

        if (category) {
            whereClauses.push('admin_blogs.category = ?');
            params.push(category);
        } else if (!req.query.all_categories) {
            // Default: Exclude Daily Reporter from the main list as it's managed separately
            whereClauses.push('admin_blogs.category NOT IN (?, ?)');
            params.push('daily_reporter', 'Daily Reporter');
        }
        if (upcoming !== undefined) {
            whereClauses.push('admin_blogs.upcoming = ?');
            params.push(upcoming);
        }
        if (status !== undefined) {
            whereClauses.push('admin_blogs.status = ?');
            params.push(status);
        }
        if (search) {
            whereClauses.push('(admin_blogs.title LIKE ? OR admin_blogs.new_slug LIKE ? OR admin_blogs.slug LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const whereString = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM admin_blogs ${whereString}`, params);
        const total = countResult[0].total;

        // Note: keeping columns limited for fast list viewing unless full is requested
        let selectColumns = 'admin_blogs.*, COALESCE(NULLIF(admin_blogs.new_slug, ""), admin_blogs.slug) as slug';
        if (req.query.summary) {
            selectColumns = 'admin_blogs.id, admin_blogs.title, COALESCE(NULLIF(admin_blogs.new_slug, ""), admin_blogs.slug) as slug, admin_blogs.image, admin_blogs.category, admin_blogs.upcoming, admin_blogs.status, admin_blogs.gmp_date, admin_blogs.gmp_ipo_price, admin_blogs.gmp, admin_blogs.created_at, admin_blogs.updated_at, admin_blogs.description';
        }

        let joinClause = '';
        let groupByClause = '';
        let orderByClause = 'ORDER BY admin_blogs.id DESC';

        if (category === 'ipo_updates') {
            joinClause = 'LEFT JOIN ipo_lists il ON il.admin_blog_id = admin_blogs.id';
            groupByClause = 'GROUP BY admin_blogs.id';
            if (upcoming === '0') {
                orderByClause = `
                    ORDER BY 
                    MIN(CASE
                        WHEN il.open_date IS NOT NULL AND il.close_date IS NOT NULL AND CURDATE() >= il.open_date AND CURDATE() <= il.close_date THEN 1
                        WHEN il.close_date IS NOT NULL AND il.listing_date IS NOT NULL AND CURDATE() > il.close_date AND CURDATE() < il.listing_date THEN 1
                        WHEN il.listing_date IS NOT NULL AND CURDATE() = il.listing_date THEN 1
                        ELSE 2
                    END) ASC,
                    admin_blogs.id DESC
                `;
            } else if (upcoming === '1') {
                orderByClause = `
                    ORDER BY 
                    MIN(CASE
                        WHEN il.open_date IS NOT NULL AND CURDATE() < il.open_date THEN 1
                        ELSE 2
                    END) ASC,
                    admin_blogs.id DESC
                `;
            }
        }

        // Add pagination params
        params.push(limit, offset);

        const [rows] = await pool.query(
            `SELECT ${selectColumns} FROM admin_blogs ${joinClause} ${whereString} ${groupByClause} ${orderByClause} LIMIT ? OFFSET ?`,
            params
        );

        res.json({
            data: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single blog by slug
router.get('/:slug', async (req, res) => {
    try {
        const query = `
                SELECT a.*, COALESCE(NULLIF(a.new_slug, ""), a.slug) as slug, 
                    d.pdf as linked_digest_pdf, 
                    COALESCE(a.linked_digest_id, d.id) as linked_digest_id
                FROM admin_blogs a
                LEFT JOIN daily_digests d ON a.id = d.reporter_blog
                WHERE a.new_slug = ? OR a.slug = ? OR a.id = ? LIMIT 1
            `;
        const [rows] = await pool.query(query, [req.params.slug, req.params.slug, req.params.slug]);
        if (rows.length === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single blog by ID (for admin editing)
router.get('/id/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM admin_blogs WHERE id = ? LIMIT 1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new blog
router.post('/', async (req, res) => {
    try {
        const categoryFolders = {
            ipo_blogs: 'blogs',
            news: 'news',
            ipo_updates: 'companyblog',
            city_blogs: 'city',
            daily_reporter: 'dailyreporter'
        };

        const allowedFields = ['title', 'new_slug', 'slug', 'image', 'content', 'faqs', 'user_id', 'status', 'confidential', 'upcoming', 'category', 'new_highlight_text', 'gmp_date', 'gmp_ipo_price', 'gmp', 'gmp_last_updated', 'ipo_details', 'ipo_description', 'ipo_timeline_details', 'ipo_timeline_description', 'ipo_lots_application', 'ipo_lots', 'ipo_lots_share', 'ipo_lots_amount', 'promotor_hold_pre_issue', 'promotor_hold_post_issue', 'finantial_information_ended', 'finantial_information_assets', 'finantial_information_revenue', 'finantial_information_profit_tax', 'financial_info_reserves_surplus', 'finantial_information_networth', 'finantial_information_borrowing', 'key_kpi', 'key_value', 'key_pri_ipo_eps', 'key_pos_ipo_eps', 'key_pre_ipo_pe', 'key_post_ipo_pe', 'competative_strenght', 'meta_title', 'description', 'keyword', 'rhp', 'drhp', 'confidential_drhp', 'state', 'city', 'pincode', 'drhp_status', 'linked_digest_id', 'recientipo', 'private_equity', 'business_economics_update', 'geopolitical_update', 'source'];

        // BLOG IMAGE
        if (req.body.blog_image_file) {

            const folder =
                categoryFolders[req.body.category] || 'default';

            const imageUrl = await uploadFile(
                req.body.blog_image_file,
                folder
            );

            req.body.image = imageUrl;
        }

        // RHP PDF
        if (req.body.rhp_file) {

            const rhpUrl = await uploadFile(
                req.body.rhp_file,
                'companyblog_rhp'
            );

            req.body.rhp = rhpUrl;
        }

        // DRHP PDF
        if (req.body.drhp_file) {

            const drhpUrl = await uploadFile(
                req.body.drhp_file,
                'companyblog_drhp'
            );

            req.body.drhp = drhpUrl;
        }

        // CONFIDENTIAL DRHP
        if (req.body.confidential_drhp_file) {

            const confidentialUrl = await uploadFile(
                req.body.confidential_drhp_file,
                'companyblog_confidential'
            );

            req.body.confidential_drhp = confidentialUrl;
        }


        let keys = [];
        let values = [];
        let placeholders = [];

        for (const [key, val] of Object.entries(req.body)) {
            if (allowedFields.includes(key)) {
                let finalVal = val;
                let skipField = false;

                if (key === 'user_id') {
                    finalVal = Number(val) || 1;
                } else if (key === 'new_slug' || key === 'slug') {
                    // Slug validation: small letters, numbers, and hyphens only
                    const slugVal = String(val || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

                    if (slugVal) {
                        finalVal = slugVal;
                    } else if (val && val.trim() !== '') {
                        // Only error if a non-empty value was provided but became empty after sanitization
                        return res.status(400).json({ error: 'invalid slug' });
                    } else {
                        // If slug is empty after sanitization, we skip it
                        skipField = true;
                    }
                } else if (['gmp', 'gmp_ipo_price'].includes(key)) {
                    // Support both single values and JSON arrays for multiple GMP updates
                    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(val);
                            if (Array.isArray(parsed)) {
                                finalVal = JSON.stringify(parsed.map(v => String(v || '').trim()));
                            } else {
                                finalVal = JSON.stringify([String(parsed || '').trim()]);
                            }
                        } catch (e) {
                            finalVal = JSON.stringify([String(val || '').trim()]);
                        }
                    } else {
                        finalVal = JSON.stringify([String(val || '').trim()]);
                    }
                } else if (['gmp_date', 'gmp_last_updated'].includes(key)) {
                    // Support both single values and JSON arrays for multiple GMP updates
                    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(val);
                            if (Array.isArray(parsed)) {
                                finalVal = JSON.stringify(parsed.map(v => {
                                    const dateMatch = String(v || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                                    return dateMatch ? dateMatch[0] : "";
                                }));
                            } else {
                                const dateMatch = String(parsed || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                                finalVal = JSON.stringify([dateMatch ? dateMatch[0] : ""]);
                            }
                        } catch (e) {
                            const dateMatch = String(val || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                            finalVal = JSON.stringify([dateMatch ? dateMatch[0] : ""]);
                        }
                    } else {
                        const dateMatch = String(val || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                        finalVal = JSON.stringify([dateMatch ? dateMatch[0] : ""]);
                    }
                } else if (['content', 'faqs'].includes(key)) {
                    finalVal = val === null ? "" : String(val).trim();
                } else {
                    finalVal = val === '' ? null : (typeof val === 'string' ? val.trim() : val);
                }

                if (!skipField) {
                    keys.push(key);
                    values.push(finalVal);
                    placeholders.push('?');
                }
            }
        }

        // Required fields validation
        if (!req.body.title) return res.status(400).json({ error: 'Title is required' });
        // Image validation removed as per user request

        // Final check for slug
        const finalSlug = (String(req.body.new_slug || '') || String(req.body.slug || '')).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        if (!finalSlug) return res.status(400).json({ error: 'invalid slug' });

        // 👇 IMPORTANT: ensure user_id always added
        if (!keys.includes('user_id')) {
            keys.push('user_id');
            values.push(1);
            placeholders.push('?');
        }

        if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        const query = `INSERT INTO admin_blogs (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
        const [result] = await pool.execute(query, values);

        const [rows] = await pool.execute('SELECT * FROM admin_blogs WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update an existing blog
router.put('/:id', async (req, res) => {
    try {
        const allowedFields = ['title', 'new_slug', 'slug', 'image', 'content', 'faqs', 'user_id', 'status', 'confidential', 'upcoming', 'category', 'new_highlight_text', 'gmp_date', 'gmp_ipo_price', 'gmp', 'gmp_last_updated', 'ipo_details', 'ipo_description', 'ipo_timeline_details', 'ipo_timeline_description', 'ipo_lots_application', 'ipo_lots', 'ipo_lots_share', 'ipo_lots_amount', 'promotor_hold_pre_issue', 'promotor_hold_post_issue', 'finantial_information_ended', 'finantial_information_assets', 'finantial_information_revenue', 'finantial_information_profit_tax', 'financial_info_reserves_surplus', 'finantial_information_networth', 'finantial_information_borrowing', 'key_kpi', 'key_value', 'key_pri_ipo_eps', 'key_pos_ipo_eps', 'key_pre_ipo_pe', 'key_post_ipo_pe', 'competative_strenght', 'meta_title', 'description', 'keyword', 'rhp', 'drhp', 'confidential_drhp', 'state', 'city', 'pincode', 'drhp_status', 'linked_digest_id', 'recientipo', 'private_equity', 'business_economics_update', 'geopolitical_update', 'source'];

        let updates = [];
        let values = [];

        for (const [key, val] of Object.entries(req.body)) {
            if (allowedFields.includes(key)) {
                if (key === 'new_slug' || key === 'slug') {
                    const slugVal = String(val || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                    if (slugVal) {
                        updates.push(`${key} = ?`);
                        values.push(slugVal);
                    } else if (val && val.trim() !== '') {
                        // Only error if a non-empty value was provided but became empty after sanitization
                        return res.status(400).json({ error: 'invalid slug' });
                    }
                    // If val is empty, we just skip updating this specific field
                } else if (['gmp', 'gmp_ipo_price'].includes(key)) {
                    updates.push(`${key} = ?`);
                    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(val);
                            if (Array.isArray(parsed)) {
                                values.push(JSON.stringify(parsed.map(v => String(v || '').trim())));
                            } else {
                                values.push(JSON.stringify([String(parsed || '').trim()]));
                            }
                        } catch (e) {
                            values.push(JSON.stringify([String(val || '').trim()]));
                        }
                    } else {
                        values.push(JSON.stringify([String(val || '').trim()]));
                    }
                } else if (['gmp_date', 'gmp_last_updated'].includes(key)) {
                    updates.push(`${key} = ?`);
                    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(val);
                            if (Array.isArray(parsed)) {
                                values.push(JSON.stringify(parsed.map(v => {
                                    const dateMatch = String(v || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                                    return dateMatch ? dateMatch[0] : "";
                                })));
                            } else {
                                const dateMatch = String(parsed || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                                values.push(JSON.stringify([dateMatch ? dateMatch[0] : ""]));
                            }
                        } catch (e) {
                            const dateMatch = String(val || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                            values.push(JSON.stringify([dateMatch ? dateMatch[0] : ""]));
                        }
                    } else {
                        const dateMatch = String(val || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s*,?\s*\d{4}(\s*\|\s*\d{1,2}:\d{2}\s*[AaPp][Mm])?/);
                        values.push(JSON.stringify([dateMatch ? dateMatch[0] : ""]));
                    }
                } else if (['content', 'faqs'].includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(val === null ? "" : String(val).trim());
                } else {
                    updates.push(`${key} = ?`);
                    if (typeof val === "string") {
                        const trimmed = val.trim();
                        values.push(trimmed === '' ? null : trimmed);
                    } else {
                        values.push(val);
                    }
                }
            }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No valid fields provided to update' });

        // Required fields validation if present in body
        if (req.body.title === "") return res.status(400).json({ error: 'Title is required' });
        // Image validation removed as per user request

        values.push(req.params.id);

        const query = `UPDATE admin_blogs SET ${updates.join(', ')} WHERE id = ?`;
        await pool.execute(query, values);

        const [rows] = await pool.execute('SELECT * FROM admin_blogs WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Blog not found after update' });

        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete a blog
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM admin_blogs WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
