import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';

const router = express.Router();

// GET unread leads
router.get('/unread', async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM visitors WHERE form_type = 'contact_us' AND is_read = 0 ORDER BY created_at DESC"
        );
        res.json({
            data: rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all leads with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.execute("SELECT COUNT(*) as total FROM visitors WHERE form_type = 'contact_us'");
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT * FROM visitors WHERE form_type = 'contact_us' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
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

// POST create a new lead
router.post('/', verifyRecaptcha('contact_form'), async (req, res) => {
    try {
        let { name, email, phone, company, subject, message } = req.body;
        company = company || '';
        subject = subject || '';

        // ✅ Required fields
        if (!name || !email || !phone || !message) {
            return res.status(400).json({ error: 'Name, email, phone, and message are required.' });
        }

        // ✅ Name: only letters and spaces (no numbers)
        if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
            return res.status(400).json({ error: 'Full name must contain only letters (no numbers allowed).' });
        }

        // ✅ Email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }

        // ✅ Phone: exactly 10 digits
        if (!/^\d{10}$/.test(phone.trim())) {
            return res.status(400).json({ error: 'Phone must be exactly 10 digits (numbers only).' });
        }

        // ✅ Message max 150 characters
        if (message.length > 150) {
            return res.status(400).json({ error: 'Message cannot exceed 150 characters.' });
        }

        // ✅ Company max 50 chars
        if (company.length > 50) {
            return res.status(400).json({ error: 'Company name cannot exceed 50 characters.' });
        }

        // ✅ Subject max 50 chars
        if (subject.length > 50) {
            return res.status(400).json({ error: 'Subject cannot exceed 50 characters.' });
        }

        const [result] = await pool.execute(
            "INSERT INTO visitors (form_type, name, email, mobile, cname, subject, message) VALUES ('contact_us', ?, ?, ?, ?, ?, ?)",
            [name.trim(), email.trim(), phone.trim(), company.trim(), subject.trim(), message.trim()]
        );
        const [rows] = await pool.execute("SELECT * FROM visitors WHERE id = ? AND form_type = 'contact_us'", [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a lead (usually toggling is_read)
router.put('/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE visitors SET ${fields} WHERE id = ? AND form_type = 'contact_us'`, values);
        const [rows] = await pool.execute("SELECT * FROM visitors WHERE id = ? AND form_type = 'contact_us'", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a lead
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute("DELETE FROM visitors WHERE id = ? AND form_type = 'contact_us'", [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
