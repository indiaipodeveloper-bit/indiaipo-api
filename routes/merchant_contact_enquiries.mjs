import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';

const router = express.Router();

// GET all enquiries (Admin only)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM merchant_contact_enquiries ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST submit an enquiry
router.post('/', verifyRecaptcha('merchant_contact_form'), async (req, res) => {
    try {
        const { ipo_type, name, email, mobile = '', company = '', message } = req.body;

        if (!ipo_type || !name || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const [result] = await pool.query(
            'INSERT INTO merchant_contact_enquiries (ipo_type, name, email, mobile, company, message) VALUES (?, ?, ?, ?, ?, ?)',
            [ipo_type, name, email, mobile, company, message]
        );
        
        res.status(201).json({ id: result.insertId, message: 'Enquiry submitted successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH mark as read
router.patch('/:id/read', async (req, res) => {
    try {
        const [result] = await pool.execute('UPDATE merchant_contact_enquiries SET is_read = 1 WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Enquiry not found' });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE an enquiry
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM merchant_contact_enquiries WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Enquiry not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
