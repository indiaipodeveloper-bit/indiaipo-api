import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';

const router = express.Router();

// GET all enquiries (Admin only)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT v.*, c.name as consultant_name 
            FROM visitors v
            JOIN consultants c ON v.consultant_id = c.id
            WHERE v.form_type = 'consultant_enquiry'
            ORDER BY v.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST submit an enquiry
router.post('/', verifyRecaptcha('consultant_enquiry_form'), async (req, res) => {
    try {
        let { consultant_id, name, email, phone, organisation, designation, turnover, message } = req.body;
        organisation = organisation || '';
        designation = designation || '';
        turnover = turnover || '';

        // ✅ Required fields check
        if (!consultant_id || !name || !email || !message || !phone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // ✅ 1. Phone validation (only digits & exactly 10)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Phone must be exactly 10 digits and numeric only' });
        }

        // ✅ 2. Organisation max 100 chars
        if (organisation.length > 100) {
            return res.status(400).json({ error: 'Organisation cannot exceed 100 characters' });
        }

        // ✅ 3. Message max 400 chars
        if (message.length > 400) {
            return res.status(400).json({ error: 'Message cannot exceed 400 characters' });
        }

        // ✅ Insert into visitors
        const [result] = await pool.execute(
            "INSERT INTO visitors (form_type, consultant_id, name, email, mobile, cname, designation, turnover, message) VALUES ('consultant_enquiry', ?, ?, ?, ?, ?, ?, ?, ?)",
            [consultant_id, name, email, phone, organisation, designation, turnover, message]
        );

        res.status(201).json({ id: result.insertId, message: 'Enquiry submitted successfully' });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH mark as read
router.patch('/:id/read', async (req, res) => {
    try {
        const [result] = await pool.execute("UPDATE visitors SET is_read = 1 WHERE id = ? AND form_type = 'consultant_enquiry'", [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Enquiry not found' });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE an enquiry
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute("DELETE FROM visitors WHERE id = ? AND form_type = 'consultant_enquiry'", [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Enquiry not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
