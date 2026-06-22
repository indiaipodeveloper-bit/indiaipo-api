import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET popup settings
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM site_popup LIMIT 1');
        if (rows.length === 0) {
            return res.json({
                title: 'New Release',
                description: 'Check out our latest news!',
                image_url: null,
                button_text: 'Learn More',
                button_link: '#',
                is_active: 0
            });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update popup settings
router.put('/', async (req, res) => {
    try {
        const { title, description, image_url, button_text, button_link, is_active } = req.body;
        
        // Check if record exists
        const [rows] = await pool.execute('SELECT id FROM site_popup LIMIT 1');
        
        if (rows.length === 0) {
            // This case should ideally not happen because we seed in index.js, but just in case
            await pool.execute(
                'INSERT INTO site_popup (title, description, image_url, button_text, button_link, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                [title, description, image_url, button_text, button_link, is_active]
            );
        } else {
            const id = rows[0].id;
            await pool.execute(
                'UPDATE site_popup SET title = ?, description = ?, image_url = ?, button_text = ?, button_link = ?, is_active = ? WHERE id = ?',
                [title, description, image_url, button_text, button_link, is_active, id]
            );
        }
        
        const [updatedRows] = await pool.execute('SELECT * FROM site_popup LIMIT 1');
        res.json(updatedRows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
