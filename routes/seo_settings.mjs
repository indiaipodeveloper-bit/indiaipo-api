import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// 🔹 Helper: URL validation
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// 🔹 GET SEO
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM seo_settings LIMIT 1');

        if (rows.length === 0) {
            return res.status(404).json({ error: 'SEO settings not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 🔹 SAVE SEO (WITH VALIDATION)
router.post('/', async (req, res) => {
    try {
        let { meta_title, meta_description, keywords, og_image } = req.body;

        // =========================
        // ✅ VALIDATIONS START
        // =========================

        // Title required
        if (!meta_title || meta_title.trim() === '') {
            return res.status(400).json({ error: 'Meta title is required' });
        }

        meta_title = meta_title.trim();

        if (meta_title.length > 60) {
            return res.status(400).json({
                error: `Meta title max 60 characters allowed (${meta_title.length})`
            });
        }

        // Description required
        if (!meta_description || meta_description.trim() === '') {
            return res.status(400).json({ error: 'Meta description is required' });
        }

        meta_description = meta_description.trim();

        if (meta_description.length > 160) {
            return res.status(400).json({
                error: `Meta description max 160 characters allowed (${meta_description.length})`
            });
        }

        // Keywords (optional cleanup)
        if (keywords) {
            keywords = keywords
                .split(',')
                .map(k => k.trim())
                .filter(Boolean)
                .join(', ');
        } else {
            keywords = '';
        }

        // OG Image validation (optional)
        if (og_image) {
            const isLocalPath = og_image.startsWith('uploads/') || og_image.startsWith('/uploads/');
            if (!isLocalPath && !isValidUrl(og_image)) {
                return res.status(400).json({ error: 'OG Image must be a valid URL or local path' });
            }
        } else {
            og_image = '';
        }

        // =========================
        // ✅ VALIDATIONS END
        // =========================

        // Check existing row
        const [check] = await pool.execute('SELECT id FROM seo_settings LIMIT 1');

        if (check.length > 0) {
            await pool.execute(
                `UPDATE seo_settings 
         SET meta_title = ?, meta_description = ?, keywords = ?, og_image = ?
         WHERE id = ?`,
                [meta_title, meta_description, keywords, og_image, check[0].id]
            );
        } else {
            await pool.execute(
                `INSERT INTO seo_settings 
         (meta_title, meta_description, keywords, og_image) 
         VALUES (?, ?, ?, ?)`,
                [meta_title, meta_description, keywords, og_image]
            );
        }

        res.json({
            success: true,
            message: 'SEO settings saved successfully'
        });

    } catch (err) {
        console.error("SEO Save Error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
