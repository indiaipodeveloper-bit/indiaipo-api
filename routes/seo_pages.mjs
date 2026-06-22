import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Auto-create seo_pages table on startup
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS seo_pages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_path VARCHAR(500) NOT NULL UNIQUE COMMENT 'URL path e.g. /services/sme-ipo',
                page_label VARCHAR(255) DEFAULT '' COMMENT 'Human-readable label for admin',
                meta_title VARCHAR(300) DEFAULT '',
                meta_description TEXT,
                meta_keywords TEXT,
                og_image VARCHAR(500) DEFAULT '',
                canonical VARCHAR(500) DEFAULT '',
                schema_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // Add schema_json if not exists
        try {
            await pool.query('ALTER TABLE seo_pages ADD COLUMN schema_json TEXT AFTER canonical');
            console.log("✅ 'schema_json' column added to seo_pages");
        } catch (e) {
            // Ignore if column already exists
        }
        console.log("✅ 'seo_pages' table ready");
    } catch (err) {
        console.error("❌ seo_pages table init error:", err.message);
    }
})();

// GET all pages
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM seo_pages ORDER BY updated_at DESC'
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single page by path (for SSR middleware lookup)
router.get('/by-path', async (req, res) => {
    try {
        const pagePath = req.query.path;
        if (!pagePath) return res.status(400).json({ error: 'path query required' });

        const [rows] = await pool.query(
            'SELECT * FROM seo_pages WHERE page_path = ? LIMIT 1',
            [pagePath]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create or update (upsert by page_path)
router.post('/', async (req, res) => {
    try {
        const { page_path, page_label = '', meta_title = '', meta_description = '', meta_keywords = '', og_image = '', canonical = '', schema_json = '' } = req.body;

        if (!page_path || !page_path.trim()) {
            return res.status(400).json({ error: 'page_path is required' });
        }

        const cleanPath = '/' + page_path.replace(/^\/+/, '').trim();

        await pool.query(
            `INSERT INTO seo_pages (page_path, page_label, meta_title, meta_description, meta_keywords, og_image, canonical, schema_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               page_label = VALUES(page_label),
               meta_title = VALUES(meta_title),
               meta_description = VALUES(meta_description),
               meta_keywords = VALUES(meta_keywords),
               og_image = VALUES(og_image),
               canonical = VALUES(canonical),
               schema_json = VALUES(schema_json),
               updated_at = CURRENT_TIMESTAMP`,
            [cleanPath, page_label, meta_title, meta_description, meta_keywords, og_image, canonical, schema_json]
        );

        const [rows] = await pool.query('SELECT * FROM seo_pages WHERE page_path = ?', [cleanPath]);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update by ID
router.put('/:id', async (req, res) => {
    try {
        const { page_path, page_label, meta_title, meta_description, meta_keywords, og_image, canonical, schema_json } = req.body;
        const { id } = req.params;

        await pool.query(
            `UPDATE seo_pages SET
               page_path = COALESCE(?, page_path),
               page_label = COALESCE(?, page_label),
               meta_title = COALESCE(?, meta_title),
               meta_description = COALESCE(?, meta_description),
               meta_keywords = COALESCE(?, meta_keywords),
               og_image = COALESCE(?, og_image),
               canonical = COALESCE(?, canonical),
               schema_json = COALESCE(?, schema_json),
               updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [page_path, page_label, meta_title, meta_description, meta_keywords, og_image, canonical, schema_json, id]
        );

        const [rows] = await pool.query('SELECT * FROM seo_pages WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE by ID
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM seo_pages WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
