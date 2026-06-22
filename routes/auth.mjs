import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.mjs';
import rateLimit from 'express-rate-limit';
import { authenticateAdmin } from '../middleware/auth.mjs';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'Indiaipo@123';

// Rate limiter for login requests
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    validate: { xForwardedForHeader: false }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active' && user.status !== '1') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.put('/profile', authenticateAdmin, async (req, res) => {
    try {
        const { email, currentPassword, newPassword, name } = req.body;
        const userId = req.user.id; // from authenticateAdmin middleware

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];

        // Ensure current password is valid before changing any credentials
        if (currentPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect current password' });
            }
        } else if (newPassword || email !== user.email) {
            return res.status(400).json({ error: 'Current password is required to change email or password' });
        }

        // Check if new email is already taken by another user
        if (email !== user.email) {
            const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email is already in use by another account' });
            }
        }

        let updateQuery = 'UPDATE users SET email = ?, name = ?';
        const queryParams = [email, name || user.name];

        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            updateQuery += ', password = ?';
            queryParams.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(userId);

        await pool.execute(updateQuery, queryParams);

        // Fetch updated user to return
        const [updatedUsers] = await pool.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Profile updated successfully', user: updatedUsers[0] });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await pool.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Fetch me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
