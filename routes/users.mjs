import express from 'express';
import pool from '../db.mjs';
import { authenticateAdmin } from '../middleware/auth.mjs';

const router = express.Router();

// Get all users
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, role, status, created_at, updated_at FROM users ORDER BY id DESC');
        res.json({ users: rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user role
router.put('/:id/role', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        const [result] = await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Block/unblock user
router.put('/:id/block', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Toggle the status
        const [users] = await pool.execute('SELECT status FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentStatus = users[0].status;
        // In DB status might be 'active' / 'inactive' or '1' / '0'
        let newStatus = currentStatus === '1' ? '0' : '1';
        if (currentStatus === 'active') newStatus = 'inactive';
        else if (currentStatus === 'inactive') newStatus = 'active';

        await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

        res.json({ message: 'User status updated successfully', status: newStatus });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
