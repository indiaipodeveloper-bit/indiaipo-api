import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all bankers
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const fetchAll = req.query.all === 'true'; 
        const ids = req.query.ids;

        if (ids) {
            const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (idArray.length > 0) {
                const [rows] = await pool.query(`SELECT * FROM marchantbankers WHERE id IN (${idArray.join(',')})`);
                const mappedRows = rows.map(r => ({
                    ...r,
                    name: r.title,
                    logo_url: r.image ? (r.image.startsWith('/') ? r.image : '/' + r.image) : null
                }));
                return res.json({ data: mappedRows });
            }
        }

        if (fetchAll) {
            const [rows] = await pool.query("SELECT * FROM marchantbankers ORDER BY title ASC");
            const mappedRows = rows.map(r => ({
                ...r,
                name: r.title,
                logo_url: r.image ? (r.image.startsWith('/') ? r.image : '/' + r.image) : null
            }));
            return res.json({ data: mappedRows });
        }

    const categorySlug = req.query.category || 'list-of-sme-merchant-bankers';
    let query = "SELECT * FROM marchantbankers WHERE mcat_id = ?";
    let countQuery = "SELECT COUNT(*) as total FROM marchantbankers WHERE mcat_id = ?";
    const params = [categorySlug];
    const conditions = [];
    
    if (search) {
        const searchClause = " AND (title LIKE ? OR sub_title LIKE ? OR description LIKE ?)";
        query += searchClause;
        countQuery += searchClause;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY id DESC';

    if (!fetchAll) {
        query += ' LIMIT ? OFFSET ?';
    }

    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    const dataParams = fetchAll ? params : [...params, limit, offset];
    const [rows] = await pool.query(query, dataParams);
    
    // Ensure logo_url starts with / for getImageUrl to work correctly across ports
    const mappedRows = rows.map(r => ({
        ...r,
        name: r.title, // Map title to name for consistency
        logo_url: r.image ? (r.image.startsWith('/') ? r.image : '/' + r.image) : null
    }));
    
    res.json({
        data: mappedRows,
            pagination: fetchAll ? null : {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single banker by ID (full details)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM marchantbankers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Banker not found' });
        const r = rows[0];
        res.json({
            ...r,
            name: r.title,
            logo_url: r.image ? (r.image.startsWith('/') ? r.image : '/' + r.image) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single banker by slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM marchantbankers WHERE slug = ?', [req.params.slug]);
        if (rows.length === 0) return res.status(404).json({ error: 'Banker not found' });
        const r = rows[0];
        res.json({
            ...r,
            name: r.title,
            logo_url: r.image ? (r.image.startsWith('/') ? r.image : '/' + r.image) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a banker
router.post('/', async (req, res) => {
    try {
        const {
            title = '', sub_title = '', slug = '', mcat_id = 'list-of-sme-merchant-bankers', image = '', description = '',
            meta_title = '', meta_desc = '', meta_keywords = '', noOfiposofar = '', ipos = '',
            totalfundraised = '', avgiposize = '', avglisting_gain = '', avgsubscription = '',
            faqs = '', nseemer = '', bsesme = '', yearwise_ipolisting = '', sme_ipos_by_size = '',
            sme_ipos_by_subscription = '', cemail = '', cmobile = '', caddress = '', cweblink = ''
        } = req.body;
        
        if (cemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
            return res.status(400).json({ error: "Invalid email address format" });
        }
        if (cmobile && !/^\d{10}$/.test(cmobile)) {
            return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
        }

        // Ensure mcat_id is correct for SME bankers
        const final_mcat_id = mcat_id && mcat_id !== '0' && mcat_id !== 0 ? mcat_id : 'list-of-sme-merchant-bankers';

        const [result] = await pool.execute(
            `INSERT INTO marchantbankers 
            (title, sub_title, slug, mcat_id, image, description, meta_title, meta_desc, meta_keywords,
             noOfiposofar, ipos, totalfundraised, avgiposize, avglisting_gain, avgsubscription, faqs,
             nseemer, bsesme, yearwise_ipolisting, sme_ipos_by_size, sme_ipos_by_subscription,
             cemail, cmobile, caddress, cweblink)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, sub_title, slug, final_mcat_id, image, description, meta_title, meta_desc, meta_keywords,
             noOfiposofar, ipos, totalfundraised, avgiposize, avglisting_gain, avgsubscription, faqs,
             nseemer, bsesme, yearwise_ipolisting, sme_ipos_by_size, sme_ipos_by_subscription,
             cemail, cmobile, caddress, cweblink]
        );
        
        const [rows] = await pool.execute('SELECT * FROM marchantbankers WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a banker
router.put('/:id', async (req, res) => {
    try {
        const allowedFields = [
            'title', 'sub_title', 'slug', 'mcat_id', 'image', 'description', 
            'meta_title', 'meta_desc', 'meta_keywords', 'noOfiposofar', 'ipos', 
            'totalfundraised', 'avgiposize', 'avglisting_gain', 'avgsubscription', 'faqs',
            'nseemer', 'bsesme', 'yearwise_ipolisting', 'sme_ipos_by_size', 'sme_ipos_by_subscription',
            'cemail', 'cmobile', 'caddress', 'cweblink'
        ];
        
        const updateFields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(req.body)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        const { cemail, cmobile } = req.body;
        if (cemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
            return res.status(400).json({ error: "Invalid email address format" });
        }
        if (cmobile && !/^\d{10}$/.test(cmobile)) {
            return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
        }
        
        values.push(req.params.id);
        
        const queryStr = `UPDATE marchantbankers SET ${updateFields.join(', ')} WHERE id = ?`;
        await pool.execute(queryStr, values);
        
        const [rows] = await pool.execute('SELECT * FROM marchantbankers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Banker not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error("Update Banker Error:", err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a banker
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM marchantbankers WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Banker not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
