import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Utility to generate slug
const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

// GET all subcategories
router.get('/', async (req, res) => {
    try {
        const type = req.query.type; // 'sme' or 'mainboard'
        const status = req.query.status; // 'active' or 'inactive'
        
        let query = "SELECT * FROM banker_subcategories";
        const params = [];
        const conditions = [];

        if (type) {
            conditions.push("type = ?");
            params.push(type);
        }
        
        if (status) {
            conditions.push("status = ?");
            params.push(status);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY sort_order ASC, id ASC";

        const [rows] = await pool.query(query, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching banker subcategories:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST create a subcategory
router.post('/', async (req, res) => {
    try {
        const { name, type, status = 'active', sort_order = 0 } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({ error: "Name and type are required" });
        }

        let baseSlug = generateSlug(name);
        let slug = baseSlug;
        let counter = 1;

        // Check for unique slug
        while (true) {
            const [existing] = await pool.query("SELECT id FROM banker_subcategories WHERE slug = ?", [slug]);
            if (existing.length === 0) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const [result] = await pool.execute(
            "INSERT INTO banker_subcategories (name, slug, type, status, sort_order) VALUES (?, ?, ?, ?, ?)",
            [name, slug, type, status, sort_order]
        );

        const [rows] = await pool.query('SELECT * FROM banker_subcategories WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("Create Subcategory Error:", err);
        res.status(400).json({ error: err.message });
    }
});

// PUT update a subcategory
router.put('/:id', async (req, res) => {
    try {
        const { name, type, status, sort_order } = req.body;
        const id = req.params.id;

        const updateFields = [];
        const values = [];

        if (name !== undefined) {
            updateFields.push("name = ?");
            values.push(name);
            
            // Generate new slug if name changes? Usually we keep slug same to avoid breaking links, 
            // but let's allow it for now if needed, or better, don't change slug.
        }
        
        if (type !== undefined) {
            updateFields.push("type = ?");
            values.push(type);
        }
        
        if (status !== undefined) {
            updateFields.push("status = ?");
            values.push(status);
        }

        if (sort_order !== undefined) {
            updateFields.push("sort_order = ?");
            values.push(sort_order);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        values.push(id);
        const queryStr = `UPDATE banker_subcategories SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await pool.execute(queryStr, values);
        
        const [rows] = await pool.query('SELECT * FROM banker_subcategories WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Subcategory not found' });
        
        res.json(rows[0]);
    } catch (err) {
        console.error("Update Subcategory Error:", err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a subcategory
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM banker_subcategories WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Subcategory not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
