import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all banners (optionally filter by page_path)
router.get('/', async (req, res) => {
    try {
        const { page } = req.query;
        let query = 'SELECT * FROM hero_banners';
        let params = [];
        
        if (page) {
            const pagePath = page === 'home' ? null : page;
            const isHomePage = page === 'home' || page === '/';
            let groupName = null;
            if (page.startsWith('/reports') || page === '/ipo-calendar') {
                groupName = 'group:reports';
            } else if (page.startsWith('/ipo-knowledge') || page.startsWith('/ipo-blogs') || page.startsWith('/sector-wise-ipo') || page.startsWith('/list-of-ipo-registrar')) {
                groupName = 'group:knowledge';
            } else if (page.startsWith('/notifications')) {
                groupName = 'group:notifications';
            } else if (page.startsWith('/services') || page === '/ipo-services') {
                groupName = 'group:services';
            }

            // If it's a specific page (not home), ONLY show banners for that page or its group.
            // If it's the home page, show home-specific banners OR null (legacy/default).
            if (isHomePage) {
                query = `
                    SELECT *, 1 as priority 
                    FROM hero_banners 
                    WHERE is_active = 1 AND (page_path = '/' OR page_path = 'home' OR page_path IS NULL) 
                    ORDER BY sort_order ASC
                `;
                params = [];
            } else {
                query = `
                    SELECT *, 
                    (CASE 
                        WHEN page_path = ? THEN 2 
                        WHEN page_path = ? THEN 1
                        ELSE 0 END) as priority 
                    FROM hero_banners 
                    WHERE is_active = 1 AND (page_path = ? OR page_path = ?) 
                    ORDER BY priority DESC, sort_order ASC
                `;
                params = [pagePath, groupName, pagePath, groupName];
            }
        } else {
            query += ' ORDER BY sort_order ASC';
        }
        
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching banners:', err);
        res.status(500).json({ error: err.message });
    }
});


router.post('/', async (req, res) => {
    try {
        const { title, subtitle = '', image_url, mobile_image_url = null, video_url = null, cta_text = '', cta_link = '', badge_text = '', cta2_text = '', cta2_link = '', sort_order = 0, is_active = 1, page_path = null } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO hero_banners (title, subtitle, image_url, mobile_image_url, video_url, cta_text, cta_link, badge_text, cta2_text, cta2_link, sort_order, is_active, page_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, subtitle, image_url, mobile_image_url, video_url, cta_text, cta_link, badge_text, cta2_text, cta2_link, sort_order, is_active, page_path]
        );
        const [rows] = await pool.execute('SELECT * FROM hero_banners WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating banner:', err);
        res.status(400).json({ error: err.message });
    }
});

// PUT update a banner
router.put('/:id', async (req, res) => {
    try {
        const allowedFields = ['title', 'subtitle', 'image_url', 'mobile_image_url', 'video_url', 'cta_text', 'cta_link', 'badge_text', 'cta2_text', 'cta2_link', 'sort_order', 'is_active', 'page_path'];
        const keys = Object.keys(req.body).filter(key => allowedFields.includes(key));
        
        if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        const updates = keys.map(key => `${key} = ?`).join(', ');
        const values = keys.map(key => req.body[key]);
        values.push(req.params.id);

        await pool.execute(`UPDATE hero_banners SET ${updates} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM hero_banners WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating banner:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a banner
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM hero_banners WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Banner not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
