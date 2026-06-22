import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all registrars with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM registrar';
        let countQuery = 'SELECT COUNT(*) as count FROM registrar';
        let queryParams = [];
        let countParams = [];

        if (search) {
            query += ' WHERE name LIKE ? OR location LIKE ?';
            countQuery += ' WHERE name LIKE ? OR location LIKE ?';
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern);
        }

        query += ' ORDER BY (CAST(sme_ipo AS UNSIGNED) + CAST(mainboard_ipo AS UNSIGNED)) DESC, created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, queryParams);
        const [totalRows] = await pool.execute(countQuery, countParams);
        const total = totalRows[0].count;

        res.json({
            data: rows,
            pagination: {
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

// GET single registrar by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM registrar WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Registrar not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single registrar by SLUG
router.get('/slug/:slug', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM registrar WHERE slug = ?', [req.params.slug]);
        if (rows.length === 0) return res.status(404).json({ error: 'Registrar not found' });
        
        const registrar = rows[0];

        // Helper function to get full IPO data by IDs
        const getIPODetails = async (idString) => {
            if (!idString) return [];
            const ids = idString.split(',').map(id => id.trim()).filter(id => id && !isNaN(id) && id !== '0');
            if (ids.length === 0) return [];
            
            try {
                const [ipoRows] = await pool.query(
                    `SELECT i.*, b.new_slug as blog_slug 
                     FROM ipo_lists i 
                     LEFT JOIN admin_blogs b ON i.admin_blog_id = b.id
                     WHERE i.id IN (${ids.map(() => '?').join(',')}) 
                     ORDER BY i.created_at DESC`,
                    ids
                );
                return ipoRows;
            } catch (err) {
                console.error("Error fetching IPO details:", err);
                return [];
            }
        };

        // Resolve IPO details for SME and Mainboard
        registrar.latest_sme_ipos = await getIPODetails(registrar.latest_sme);
        registrar.latest_mainboard_ipos = await getIPODetails(registrar.latest_mainbord);

        res.json(registrar);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create registrar
router.post('/', async (req, res) => {
    try {
        const {
            name, image, meta_title, meta_desc, meta_keywords, slug,
            sme_ipo, mainboard_ipo, sme_ipo_parentage, mainboard_ipo_parentage,
            avgsubscription_sme, avgsubscription_mainboard, location, dic,
            registrar_year, latest_sme, latest_mainbord, faqs, status
        } = req.body;

        // Validation for established year
        if (registrar_year && !/^\d+$/.test(String(registrar_year))) {
            return res.status(400).json({ error: 'Established Year must contain only numbers' });
        }

        const [result] = await pool.execute(
            `INSERT INTO registrar (
                name, image, meta_title, meta_desc, meta_keywords, slug,
                sme_ipo, mainboard_ipo, sme_ipo_parentage, mainboard_ipo_parentage,
                avgsubscription_sme, avgsubscription_mainboard, location, dic,
                registrar_year, latest_sme, latest_mainbord, faqs, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, image, meta_title, meta_desc, meta_keywords, slug,
                sme_ipo, mainboard_ipo, sme_ipo_parentage, mainboard_ipo_parentage,
                avgsubscription_sme, avgsubscription_mainboard, location, dic,
                registrar_year, latest_sme, latest_mainbord, faqs, status || 'Active'
            ]
        );

        res.status(201).json({ id: result.insertId, message: 'Registrar created successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update registrar
router.put('/:id', async (req, res) => {
    try {
        const {
            name, image, meta_title, meta_desc, meta_keywords, slug,
            sme_ipo, mainboard_ipo, sme_ipo_parentage, mainboard_ipo_parentage,
            avgsubscription_sme, avgsubscription_mainboard, location, dic,
            registrar_year, latest_sme, latest_mainbord, faqs, status
        } = req.body;

        // Validation for established year
        if (registrar_year && !/^\d+$/.test(String(registrar_year))) {
            return res.status(400).json({ error: 'Established Year must contain only numbers' });
        }

        await pool.execute(
            `UPDATE registrar SET 
                name = ?, image = ?, meta_title = ?, meta_desc = ?, meta_keywords = ?, slug = ?,
                sme_ipo = ?, mainboard_ipo = ?, sme_ipo_parentage = ?, mainboard_ipo_parentage = ?,
                avgsubscription_sme = ?, avgsubscription_mainboard = ?, location = ?, dic = ?,
                registrar_year = ?, latest_sme = ?, latest_mainbord = ?, faqs = ?, status = ?,
                update_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                name, image, meta_title, meta_desc, meta_keywords, slug,
                sme_ipo, mainboard_ipo, sme_ipo_parentage, mainboard_ipo_parentage,
                avgsubscription_sme, avgsubscription_mainboard, location, dic,
                registrar_year, latest_sme, latest_mainbord, faqs, status,
                req.params.id
            ]
        );

        res.json({ message: 'Registrar updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE registrar
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM registrar WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Registrar not found' });
        res.json({ message: 'Registrar deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
