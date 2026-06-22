import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// ── Helpers ──
const isBlank = (v) => !v || !String(v).trim();

// GET all notifications
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM notification_pdfs ORDER BY sort_order ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a notification
router.post('/', async (req, res) => {
    try {
        const { title, slug, pdf_url = null, link = null, description = '', is_active = 1, sort_order = 0 } = req.body;

        // ✅ Title required
        if (isBlank(title)) {
            return res.status(400).json({ error: 'Title is required.' });
        }

        // ✅ Slug required (auto-generated on frontend, but validate anyway)
        if (isBlank(slug)) {
            return res.status(400).json({ error: 'Slug is required.' });
        }

        // ✅ Title max length
        if (String(title).trim().length > 255) {
            return res.status(400).json({ error: 'Title cannot exceed 255 characters.' });
        }

        // ✅ Link format check if provided
        if (link && link.trim().length > 0) {
            if (link.trim().length > 500) {
                return res.status(400).json({ error: 'Link URL is too long (max 500 characters).' });
            }
        }

        const [result] = await pool.execute(
            'INSERT INTO notification_pdfs (title, slug, pdf_url, link, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title.trim(), slug.trim(), pdf_url, link?.trim() || null, description || null, is_active, sort_order]
        );
        const [rows] = await pool.execute('SELECT * FROM notification_pdfs WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a notification
router.put('/:id', async (req, res) => {
    try {
        // ✅ If title is being updated, it must not be blank
        if ('title' in req.body && isBlank(req.body.title)) {
            return res.status(400).json({ error: 'Title is required and cannot be empty.' });
        }

        // ✅ Title length check
        if (req.body.title && String(req.body.title).trim().length > 255) {
            return res.status(400).json({ error: 'Title cannot exceed 255 characters.' });
        }

        // Trim string values
        const sanitized = {};
        for (const [k, v] of Object.entries(req.body)) {
            sanitized[k] = typeof v === 'string' ? v.trim() || null : v;
        }
        // Keep booleans and numbers as-is
        if ('is_active' in req.body) sanitized.is_active = req.body.is_active;
        if ('sort_order' in req.body) sanitized.sort_order = req.body.sort_order;

        const fields = Object.keys(sanitized).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(sanitized), req.params.id];
        await pool.execute(`UPDATE notification_pdfs SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM notification_pdfs WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a notification
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM notification_pdfs WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
