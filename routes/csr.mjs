import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Ensure table exists
const initTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS about_csr (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                image VARCHAR(512),
                dsc TEXT,
                status VARCHAR(50) DEFAULT 'published',
                create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        try {
            await pool.query(`ALTER TABLE about_csr ADD COLUMN status VARCHAR(50) DEFAULT 'published'`);
        } catch (e) {
            // Error code 1060: Duplicate column name 'status' - safely ignore
        }

        // Update any existing records without a status
        await pool.query(`UPDATE about_csr SET status = 'published' WHERE status IS NULL OR status = ''`);

        console.log("✅ 'about_csr' table verified");
    } catch (err) {
        console.error("❌ Error verifying 'about_csr' table:", err.message);
    }
};

initTable();

// Get all CSR entries
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM about_csr ORDER BY create_at DESC');
        res.json(rows);
    } catch (err) {
        console.error("Error fetching CSR entries:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Create CSR entry
router.post('/', async (req, res) => {
    try {
        const { title, image, dsc, status } = req.body;

        // ✅ Title required
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Title is required' });
        }

        // ✅ Image required
        if (!image || image.trim() === '') {
            return res.status(400).json({ error: 'Image is required' });
        }

        // ✅ Description required
        if (!dsc || dsc.trim() === '') {
            return res.status(400).json({ error: 'Description is required' });
        }

        const [result] = await pool.query(
            'INSERT INTO about_csr (title, image, dsc, status) VALUES (?, ?, ?, ?)',
            [title, image, dsc, status || 'published']
        );

        res.status(201).json({ id: result.insertId, message: "CSR entry created successfully" });
    } catch (err) {
        console.error("Error creating CSR entry:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Update CSR entry
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, image, dsc, status } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (!image || image.trim() === '') {
            return res.status(400).json({ error: 'Image is required' });
        }

        if (!dsc || dsc.trim() === '') {
            return res.status(400).json({ error: 'Description is required' });
        }

        const [result] = await pool.query(
            'UPDATE about_csr SET title = ?, image = ?, dsc = ?, status = ? WHERE id = ?',
            [title, image, dsc, status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }

        res.json({ message: "CSR entry updated successfully" });
    } catch (err) {
        console.error("Error updating CSR entry:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Delete CSR entry
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM about_csr WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }

        res.json({ message: "CSR entry deleted successfully" });
    } catch (err) {
        console.error("Error deleting CSR entry:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
