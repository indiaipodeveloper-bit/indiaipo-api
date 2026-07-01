import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Get all weekly digests with pagination and search
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search="", type="" } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM weekly_digests';
        let countQuery = 'SELECT COUNT(*) as total FROM weekly_digests';
        const where = [];
        const params = [];
        const countParams = [];

        if (search.trim()) {
            where.push("title LIKE ?");
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (type.trim()) {
            where.push("type = ?");
            params.push(type);
            countParams.push(type);
        }
        if(where.length > 0){
            const whereClause = ' WHERE ' + where.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);
        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

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
        console.error("Error fetching weekly digests:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Get a single weekly digest
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM weekly_digests WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Weekly digest not found" });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching weekly digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Create weekly digest
router.post('/', async (req, res) => {
    try {
        const { title, image, pdf, type } = req.body;

        const [result] = await pool.query(
            `INSERT INTO weekly_digests 
            (title, image, pdf, type, created_at, updated_at) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [title, image, pdf, type]
        );

        const digestId = result.insertId;

        res.status(201).json({
            success: true,
            digest_id: digestId,
            message: "Weekly digest created successfully"
        });

    } catch (err) {
        console.error("Error creating weekly digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Update weekly digest
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, image, pdf, type } = req.body;

        let query = 'UPDATE weekly_digests SET updated_at = CURRENT_TIMESTAMP';
        const params = [];

        if (title !== undefined) {
            query += ', title = ?';
            params.push(title);
        }
        if (image !== undefined) {
            query += ', image = ?';
            params.push(image);
        }
        if (pdf !== undefined) {
            query += ', pdf = ?';
            params.push(pdf);
        }
        if (type !== undefined) {
            query += ', type = ?';
            params.push(type);
        }
        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Weekly digest not found" });
        }

        res.json({ message: "Weekly digest updated successfully" });
    } catch (err) {
        console.error("Error updating weekly digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Delete weekly digest
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM weekly_digests WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Weekly digest not found" });
        }

        res.json({ message: "Weekly digest deleted successfully" });
    } catch (err) {
        console.error("Error deleting weekly digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
