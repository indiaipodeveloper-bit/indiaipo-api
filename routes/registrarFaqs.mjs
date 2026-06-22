import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all FAQs
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM registrar_faq ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Active FAQs for frontend
router.get('/active', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM registrar_faq WHERE status = 'Active' ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create FAQ
router.post('/', async (req, res) => {
    try {
        const { question, answer, status } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO registrar_faq (question, answer, status) VALUES (?, ?, ?)',
            [question, answer, status || 'Active']
        );
        res.status(201).json({ id: result.insertId, message: 'FAQ created successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update FAQ
router.put('/:id', async (req, res) => {
    try {
        const { question, answer, status } = req.body;
        await pool.execute(
            'UPDATE registrar_faq SET question = ?, answer = ?, status = ?, update_at = CURRENT_TIMESTAMP WHERE id = ?',
            [question, answer, status, req.params.id]
        );
        res.json({ message: 'FAQ updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE FAQ
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM registrar_faq WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'FAQ not found' });
        res.json({ message: 'FAQ deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
