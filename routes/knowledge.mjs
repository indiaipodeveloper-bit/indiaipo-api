import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// --- CATEGORIES ---

router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM knowledge_categories ORDER BY sort_order ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, slug, description = '', icon = '', sort_order = 0, is_active = 1 } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO knowledge_categories (name, slug, description, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [name, slug, description, icon, sort_order, is_active]
        );
        const [rows] = await pool.execute('SELECT * FROM knowledge_categories WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE knowledge_categories SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM knowledge_categories WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        // Items cascade deleted via FK
        const [result] = await pool.execute('DELETE FROM knowledge_categories WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ITEMS ---

router.get('/items', async (req, res) => {
    try {
        let query = 'SELECT * FROM knowledge_items';
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
            category_id, title, subtitle = null, col1 = null, col2 = null,
            col3 = null, col4 = null, col5 = null, col6 = null,
            link = null, location = null, sort_order = 0, is_active = 1
        } = req.body;
        const [result] = await pool.execute(
            `INSERT INTO knowledge_items 
            (category_id, title, subtitle, col1, col2, col3, col4, col5, col6, link, location, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [category_id, title, subtitle, col1, col2, col3, col4, col5, col6, link, location, sort_order, is_active]
        );
        const [rows] = await pool.execute('SELECT * FROM knowledge_items WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/items/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE knowledge_items SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM knowledge_items WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/items/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM knowledge_items WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
