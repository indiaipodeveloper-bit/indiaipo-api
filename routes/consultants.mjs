import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

function getMatchScore(c, b) {
    const cSlug = (c.slug || '').toLowerCase();
    const bSlug = (b.slug || '').toLowerCase();
    const bNewSlug = (b.new_slug || '').toLowerCase();
    const cLocation = (c.office_location || '').toLowerCase().trim();
    const bCity = (b.city || '').toLowerCase().trim();
    const bTitle = (b.title || '').toLowerCase();

    // 1. Exact Slug Match
    if ((bNewSlug && bNewSlug === cSlug) || (bSlug && bSlug === cSlug)) {
        return 100;
    }

    // 2. Exact City Match
    if (cLocation && bCity && cLocation === bCity) {
        return 90;
    }

    // 3. Location in new_slug / slug
    const cLocHyphenated = cLocation.replace(/\s+/g, '-');
    if (cLocation && ((bNewSlug && bNewSlug.includes(cLocHyphenated)) || (bSlug && bSlug.includes(cLocHyphenated)))) {
        return 80;
    }

    // 4. Location in title
    if (cLocation && bTitle.includes(cLocation)) {
        return 70;
    }

    // 5. City in consultant slug
    if (bCity && bCity.length > 3 && cSlug.includes(bCity)) {
        return 60;
    }

    // 6. Partial city match
    if (cLocation && bCity && (bCity.includes(cLocation) || cLocation.includes(bCity))) {
        return 50;
    }

    return 0;
}

// GET all consultants
router.get('/', async (req, res) => {
    try {
        let query = 'SELECT * FROM consultants';
        const params = [];
        if (req.query.active === 'true') {
            query += ' WHERE is_active = 1';
        }
        query += ' ORDER BY sort_order ASC, created_at DESC';
        const [rows] = await pool.execute(query, params);

        // Fetch matching city blog for each consultant
        const [blogs] = await pool.execute("SELECT id, title, slug, new_slug, city, content FROM admin_blogs WHERE category = 'city_blogs'");
        
        for (const consultant of rows) {
            let bestBlog = null;
            let bestScore = 0;
            for (const b of blogs) {
                const score = getMatchScore(consultant, b);
                if (score > bestScore) {
                    bestScore = score;
                    bestBlog = b;
                }
            }
            if (bestBlog && bestScore > 0) {
                consultant.blog_title = bestBlog.title;
                consultant.blog_content = bestBlog.content;
            } else {
                consultant.blog_title = null;
                consultant.blog_content = null;
            }
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET consultant by ID (Special route to avoid conflict with slug)
router.get('/id/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM consultants WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Consultant not found' });
        const consultant = rows[0];

        // Fetch matching city blog
        const [blogs] = await pool.execute("SELECT id, title, slug, new_slug, city, content FROM admin_blogs WHERE category = 'city_blogs'");
        let bestBlog = null;
        let bestScore = 0;
        for (const b of blogs) {
            const score = getMatchScore(consultant, b);
            if (score > bestScore) {
                bestScore = score;
                bestBlog = b;
            }
        }
        if (bestBlog && bestScore > 0) {
            consultant.blog_content = bestBlog.content;
            consultant.blog_title = bestBlog.title;
        } else {
            consultant.blog_content = null;
            consultant.blog_title = null;
        }

        res.json(consultant);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET consultant by Slug
router.get('/:slug', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM consultants WHERE slug = ?', [req.params.slug]);
        let consultant;
        if (rows.length === 0) {
            // Fallback: check if it's an ID (legacy support)
            const [idRows] = await pool.execute('SELECT * FROM consultants WHERE id = ?', [req.params.slug]);
            if (idRows.length > 0) {
                consultant = idRows[0];
            } else {
                return res.status(404).json({ error: 'Consultant not found' });
            }
        } else {
            consultant = rows[0];
        }

        // Fetch matching city blog
        const [blogs] = await pool.execute("SELECT id, title, slug, new_slug, city, content FROM admin_blogs WHERE category = 'city_blogs'");
        let bestBlog = null;
        let bestScore = 0;
        for (const b of blogs) {
            const score = getMatchScore(consultant, b);
            if (score > bestScore) {
                bestScore = score;
                bestBlog = b;
            }
        }
        if (bestBlog && bestScore > 0) {
            consultant.blog_content = bestBlog.content;
            consultant.blog_title = bestBlog.title;
        } else {
            consultant.blog_content = null;
            consultant.blog_title = null;
        }

        res.json(consultant);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a consultant
router.post('/', async (req, res) => {
    try {
        const {
            name, slug, description = '', image_url = null, is_active = 1, sort_order = 0,
            experience_years = 0, specialization = '', office_location = '',
            success_stories = '', tags = '',
            cemail = '', cmobile = '', caddress = '', cweblink = '',
            meta_title = '', meta_desc = '', meta_keywords = '',
            methodology = '', roadmap = ''
        } = req.body;

        // ✅ VALIDATIONS

        // 1. Name required
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Auto-generate slug if not provided
        const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        // Check if slug exists
        const [existing] = await pool.execute('SELECT id FROM consultants WHERE slug = ?', [finalSlug]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Slug already exists. Please choose a different name or provide a unique slug.' });
        }

        // Email validation
        if (cemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Mobile validation
        if (cmobile && !/^\d{10}$/.test(cmobile)) {
            return res.status(400).json({ error: 'Mobile must be exactly 10 digits' });
        }

        // Address validation
        if (caddress && caddress.length > 400) {
            return res.status(400).json({ error: 'Address must be less than 400 characters' });
        }

        // 2. Specialization → only alphabets + space
        if (specialization && !/^[A-Za-z\s]+$/.test(specialization)) {
            return res.status(400).json({ error: 'Specialization must contain only letters' });
        }

        // 3. Location required
        if (!office_location || office_location.trim() === '') {
            return res.status(400).json({ error: 'Office location is required' });
        }

        // 4. Image required
        if (!image_url || image_url.trim() === '') {
            return res.status(400).json({ error: 'Image is required' });
        }

        const [result] = await pool.execute(
            `INSERT INTO consultants 
            (name, slug, description, image_url, is_active, sort_order, experience_years, specialization, office_location, success_stories, tags, cemail, cmobile, caddress, cweblink, meta_title, meta_desc, meta_keywords, methodology, roadmap) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                finalSlug,
                description,
                image_url,
                is_active,
                sort_order,
                experience_years,
                specialization,
                office_location,
                success_stories,
                tags,
                cemail,
                cmobile,
                caddress,
                cweblink,
                meta_title,
                meta_desc,
                meta_keywords,
                methodology,
                roadmap
            ]
        );

        const [rows] = await pool.execute(
            'SELECT * FROM consultants WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json(rows[0]);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a consultant
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const updates = req.body;

        // ✅ VALIDATIONS

        // Name validation (only if present)
        if ('name' in updates && (!updates.name || updates.name.trim() === '')) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }

        // Slug validation (only if present)
        if ('slug' in updates && updates.slug) {
            const [existing] = await pool.execute('SELECT id FROM consultants WHERE slug = ? AND id != ?', [updates.slug, id]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Slug already exists' });
            }
        }

        // Email validation
        if ('cemail' in updates && updates.cemail) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.cemail)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }

        // Mobile validation
        if ('cmobile' in updates && updates.cmobile) {
            if (!/^\d{10}$/.test(updates.cmobile)) {
                return res.status(400).json({ error: 'Mobile must be exactly 10 digits' });
            }
        }

        // Address validation
        if ('caddress' in updates && updates.caddress && updates.caddress.length > 400) {
            return res.status(400).json({ error: 'Address must be less than 400 characters' });
        }

        // Specialization validation
        if ('specialization' in updates && updates.specialization) {
            if (!/^[A-Za-z\s]+$/.test(updates.specialization)) {
                return res.status(400).json({ error: 'Specialization must contain only letters' });
            }
        }

        // Location validation
        if ('office_location' in updates && (!updates.office_location || updates.office_location.trim() === '')) {
            return res.status(400).json({ error: 'Office location cannot be empty' });
        }

        // Image validation (if sent)
        if ('image_url' in updates && (!updates.image_url || updates.image_url.trim() === '')) {
            return res.status(400).json({ error: 'Image cannot be empty' });
        }

        // ✅ Allowed fields
        const allowedFields = [
            'name', 'slug', 'description', 'image_url', 'is_active', 'sort_order',
            'experience_years', 'specialization', 'office_location',
            'success_stories', 'tags', 'cemail', 'cmobile', 'caddress',
            'cweblink', 'meta_title', 'meta_desc', 'meta_keywords',
            'methodology', 'roadmap'
        ];

        const setClauses = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = ?`);
                params.push(value === undefined ? null : value);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        params.push(id);

        await pool.execute(
            `UPDATE consultants SET ${setClauses.join(', ')} WHERE id = ?`,
            params
        );

        const [rows] = await pool.execute(
            'SELECT * FROM consultants WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Consultant not found' });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error('Update Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a consultant
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM consultants WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Consultant not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
