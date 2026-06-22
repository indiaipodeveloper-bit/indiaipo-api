import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// GET all news
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 9;
        if (limit > 9) {
            limit = 9;
        }
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM api_news';
        let countQuery = 'SELECT COUNT(*) as count FROM api_news';
        const params = [];
        const countParams = [];
        const conditions = [];

        if (req.query.category && req.query.category !== 'All') {
            conditions.push('category = ?');
            params.push(req.query.category);
            countParams.push(req.query.category);
        }

        if (req.query.search) {
            const searchTerm = `%${req.query.search}%`;
            conditions.push('(title LIKE ? OR description LIKE ? OR content LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            const conditionStr = ' WHERE ' + conditions.join(' AND ');
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += ' ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        // Using pool.query instead of execute for better LIMIT/OFFSET support
        const [rows] = await pool.query(query, params);
        const [countResult] = await pool.query(countQuery, countParams);

        const total = countResult[0]?.count || 0;

        res.json({
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching news:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET news by ID or slug
router.get('/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isId = !isNaN(idOrSlug);

        let query = isId ? 'SELECT * FROM api_news WHERE id = ?' : 'SELECT * FROM api_news WHERE slug = ?';

        const [rows] = await pool.execute(query, [idOrSlug]);
        if (rows.length === 0) return res.status(404).json({ error: 'News not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create news
router.post('/', async (req, res) => {
    try {
        const {
            title, description = '', content = '', published_at = new Date().toISOString().split('T')[0],
            image = '', category = 'IPO', latest_news = 0, trending_news = 0, slug = '', status = 'published'
        } = req.body;

        const finalSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const [result] = await pool.execute(
            `INSERT INTO api_news (title, slug, description, content, published_at, image, category, latest_news, trending_news, status)
             VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, finalSlug, description, content, published_at, image, category, latest_news, trending_news, status]
        );
        const [rows] = await pool.execute('SELECT * FROM api_news WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update news
router.put('/:id', async (req, res) => {
    try {
        const { id, created_at, updated_at, ...updateData } = req.body;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updateData), req.params.id];

        await pool.execute(`UPDATE api_news SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM api_news WHERE id = ?', [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ error: 'News not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE news
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM api_news WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'News not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});












export default router;
