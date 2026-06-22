import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';

const router = express.Router();

// Get applications for admin
router.get('/admin/enquiries', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM career ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error("Error fetching careers:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Submit application
router.post('/apply', verifyRecaptcha('career_form'), async (req, res) => {
    try {
        const { name, last_name, email, phone, position_applied, experience, resume, coverletter } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ error: 'Name, Email and Phone number are required' });
        }

        // Check for duplicate application by email
        const [existing] = await pool.query('SELECT id FROM career WHERE email = ? LIMIT 1', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already applied using this email address.' });
        }
        // ✅ Phone validation (exact 10 digits)
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
        }

        // ✅ Experience validation (must be a number with max 2 digits before & after decimal point if provided)
        if (experience) {
            if (isNaN(Number(experience))) {
                return res.status(400).json({ error: 'Experience must be a valid number' });
            }
            const parts = experience.toString().split('.');
            if (parts[0].length > 2) {
                return res.status(400).json({ error: 'Experience cannot have more than 2 digits before the decimal point' });
            }
            if (parts.length === 2 && parts[1].length > 2) {
                return res.status(400).json({ error: 'Experience can only have up to 2 decimal places' });
            }
        }

        // Server-side validation for cover letter (max 200 words)
        if (coverletter) {
            const wordCount = coverletter.trim().split(/\s+/).filter(word => word.length > 0).length;
            if (wordCount > 200) {
                return res.status(400).json({ error: 'Cover letter must be less than 200 words' });
            }
        }



        const [result] = await pool.query(
            'INSERT INTO career (name, last_name, email, phone, position_applied, experience, resume, coverletter) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, last_name, email, phone, position_applied, experience, resume, coverletter]
        );

        res.status(201).json({ id: result.insertId, message: "Application submitted successfully" });
    } catch (err) {
        console.error("Error submitting application:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete application
router.delete('/admin/enquiries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM career WHERE id = ?', [id]);
        res.json({ message: "Application deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Roles API Endpoints ---

// Get active roles (Public)
router.get('/roles', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM career_roles WHERE is_active = 1 ORDER BY title ASC');
        res.json(rows);
    } catch (err) {
        console.error("Error fetching active career roles:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all roles (requires Admin auth, which is enforced globally in index.mjs for /api/career/admin/*)
router.get('/admin/roles', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM career_roles ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error("Error fetching all career roles:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Add new role
router.post('/admin/roles', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Role title is required' });
        }

        // Check if role already exists
        const [existing] = await pool.query('SELECT id FROM career_roles WHERE title = ? LIMIT 1', [title.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Role already exists' });
        }

        const [result] = await pool.query(
            'INSERT INTO career_roles (title, is_active) VALUES (?, 1)',
            [title.trim()]
        );

        res.status(201).json({ id: result.insertId, title: title.trim(), is_active: 1, message: "Role added successfully" });
    } catch (err) {
        console.error("Error adding career role:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update role status or title
router.put('/admin/roles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, is_active } = req.body;

        if (title !== undefined && !title.trim()) {
            return res.status(400).json({ error: 'Role title cannot be empty' });
        }

        // Check if update is valid
        const [existingRole] = await pool.query('SELECT id FROM career_roles WHERE id = ?', [id]);
        if (existingRole.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        if (title !== undefined) {
            // Check duplicate title for other roles
            const [duplicate] = await pool.query('SELECT id FROM career_roles WHERE title = ? AND id != ? LIMIT 1', [title.trim(), id]);
            if (duplicate.length > 0) {
                return res.status(400).json({ error: 'Another role with this title already exists' });
            }
        }

        // Build query dynamically
        const updates = [];
        const params = [];
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title.trim());
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        params.push(id);
        await pool.query(
            `UPDATE career_roles SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({ message: "Role updated successfully" });
    } catch (err) {
        console.error("Error updating career role:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete role
router.delete('/admin/roles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM career_roles WHERE id = ?', [id]);
        res.json({ message: "Role deleted successfully" });
    } catch (err) {
        console.error("Error deleting career role:", err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
