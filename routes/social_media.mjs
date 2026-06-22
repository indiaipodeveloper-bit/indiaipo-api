import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Initialize table
const initTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS social_media (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                img_url VARCHAR(500),
                title VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'published',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `;
        await pool.query(query);
        console.log("✅ 'social_media' table read/created in MySQL");
    } catch (err) {
        console.error("❌ Error creating social_media table:", err);
    }
};

initTable();

// Get all videos with pagination
router.get('/', async (req, res) => {
    try {
        const status = req.query.status;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        let queryStr = 'SELECT * FROM social_media';
        const params = [];

        if (status) {
            queryStr += ' WHERE status = ?';
            params.push(status);
        }

        queryStr += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(queryStr, params);

        // Get total count for pagination info
        let countQuery = 'SELECT COUNT(*) as total FROM social_media';
        const countParams = [];
        if (status) {
            countQuery += ' WHERE status = ?';
            countParams.push(status);
        }
        const [[{ total }]] = await pool.query(countQuery, countParams);

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
        console.error("Error fetching social media videos:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create new video
router.post('/', async (req, res) => {
    try {
        const { url, img_url, title, status } = req.body;
        if (!url || !title) {
            return res.status(400).json({ error: "Title and URL are required" });
        }
        const [result] = await pool.query(
            'INSERT INTO social_media (url, img_url, title, status) VALUES (?, ?, ?, ?)',
            [url, img_url, title, status || 'published']
        );
        res.status(201).json({ id: result.insertId, message: "Added successfully" });
    } catch (err) {
        console.error("Error adding video:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update video
router.put('/:id', async (req, res) => {
    try {
        const { url, img_url, title, status } = req.body;
        const [result] = await pool.query(
            'UPDATE social_media SET url=?, img_url=?, title=?, status=? WHERE id=?',
            [url, img_url, title, status, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Updated successfully" });
    } catch (err) {
        console.error("Error updating video:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete video
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM social_media WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        console.error("Error deleting video:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
