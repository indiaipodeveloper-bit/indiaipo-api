import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all blogs
router.get('/', async (req, res) => {
    try {
        let query = 'SELECT *, new_slug as slug, date as created_at FROM blog_slug';
        const params = [];
        if (req.query.status) {
            query += ' WHERE status = ?';
            params.push(req.query.status);
        }
        query += ' ORDER BY date DESC';
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET blog by slug
router.get('/:slug', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT *, new_slug as slug, date as created_at FROM blog_slug WHERE new_slug = ?', [req.params.slug]);
        if (rows.length === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a blog
router.post('/', async (req, res) => {
    try {
        const {
            title, slug, excerpt = '', content = '', category = '',
            status = 'draft', image_url = null, author = 'Admin', tags = ''
        } = req.body;

        const finalSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const [result] = await pool.execute(
            `INSERT INTO blog_slug (title, new_slug, meta_title, excerpt, content, category, status, image_url, author, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, finalSlug, title, excerpt, content, category, status, image_url, author, tags]
        );
        const [rows] = await pool.execute('SELECT *, new_slug as slug, date as created_at FROM blog_slug WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a blog
router.put('/:id', async (req, res) => {
    try {
        const { title, slug, meta_title, excerpt, content, category, status, image_url, author, tags } = req.body;
        
        await pool.execute(
            `UPDATE blog_slug SET 
            title = COALESCE(?, title),
            new_slug = COALESCE(?, new_slug),
            meta_title = COALESCE(?, meta_title),
            excerpt = COALESCE(?, excerpt),
            content = COALESCE(?, content),
            category = COALESCE(?, category),
            status = COALESCE(?, status),
            image_url = COALESCE(?, image_url),
            author = COALESCE(?, author),
            tags = COALESCE(?, tags)
            WHERE id = ?`,
            [title, slug, title, excerpt, content, category, status, image_url, author, tags, req.params.id]
        );
        
        const [rows] = await pool.execute('SELECT *, new_slug as slug, date as created_at FROM blog_slug WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a blog
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM blog_slug WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
