import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// --- CATEGORIES ---

router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM report_categories ORDER BY sort_order ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, slug, description = '', icon = 'FileText', is_active = 1, sort_order = 0 } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO report_categories (name, slug, description, icon, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [name, slug, description, icon, is_active, sort_order]
        );
        const [rows] = await pool.execute('SELECT * FROM report_categories WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE report_categories SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM report_categories WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        // Items will be cascade deleted via FK
        const [result] = await pool.execute('DELETE FROM report_categories WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ITEMS ---

router.get('/items', async (req, res) => {
    try {
        let query = 'SELECT * FROM report_items';
        const params = [];
        if (req.query.category_id) {
            query += ' WHERE category_id = ?';
            params.push(req.query.category_id);
        }
        query += ' ORDER BY sort_order ASC';
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/items', async (req, res) => {
    try {
        const {
            category_id, title, logo_url = null, status = 'Upcoming', status_color = 'blue',
            estimated_amount = '', exchange = '', sector = '', description = '',
            drhp_link = '', is_active = 1, sort_order = 0
        } = req.body;
        const [result] = await pool.execute(
            `INSERT INTO report_items 
            (category_id, title, logo_url, status, status_color, estimated_amount, exchange, sector, description, drhp_link, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [category_id, title, logo_url, status, status_color, estimated_amount, exchange, sector, description, drhp_link, is_active, sort_order]
        );
        const [rows] = await pool.execute('SELECT * FROM report_items WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/items/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE report_items SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM report_items WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/items/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM report_items WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
