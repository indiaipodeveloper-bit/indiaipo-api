import express from 'express';
import pool from '../db.mjs';
import jwt from 'jsonwebtoken';
import { uploadMizan }
    from '../helpers/uploadMizan.mjs';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'Indiaipo@123';

const isAdminRequest = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userRole = (decoded.role || '').toLowerCase();
        return userRole === 'admin' || userRole === 'super_admin' || userRole === 'super admin';
    } catch (err) {
        return false;
    }
};

// GET all magazines with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const language = req.query.language;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM magzine';
        let countQuery = 'SELECT COUNT(*) as count FROM magzine';
        let queryParams = [];
        let countParams = [];

        if (language && language !== 'undefined') {
            query += ' WHERE language = ?';
            countQuery += ' WHERE language = ?';
            queryParams.push(language);
            countParams.push(language);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        const [totalRows] = await pool.query(countQuery, countParams);
        const totalItems = totalRows[0].count;
        const totalPages = Math.ceil(totalItems / limit);

        const [rows] = await pool.query(query, queryParams);

        const admin = isAdminRequest(req);
        const processedRows = rows.map(row => {
            if (!admin && Number(row.pdf_lock) === 1) {
                return { ...row, pdf: null };
            }
            return row;
        });

        res.json({
            data: processedRows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error('Error fetching magazines:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single magazine by id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM magzine WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Magazine not found' });
        
        let row = rows[0];
        const admin = isAdminRequest(req);
        if (!admin && Number(row.pdf_lock) === 1) {
            row = { ...row, pdf: null };
        }
        
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a magazine
router.post('/', async (req, res) => {
    try {
        const { title, pdf, language = 'english', pdf_lock = '1', report_images = '' } = req.body;
        const [result] = await pool.query(
            'INSERT INTO magzine (title, pdf, language, pdf_lock, report_images, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [title, pdf, language, String(pdf_lock), report_images]
        );
        const [rows] = await pool.query('SELECT * FROM magzine WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating magazine:', err);
        res.status(400).json({ error: err.message });
    }
});

// PUT update a magazine
router.put('/:id', async (req, res) => {
    try {
        const allowedFields = ['title', 'pdf', 'language', 'pdf_lock', 'report_images'];
        const keys = Object.keys(req.body).filter(key => allowedFields.includes(key));

        if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        if (keys.includes('pdf_lock')) {
            req.body.pdf_lock = String(req.body.pdf_lock);
        }

        const updates = keys.map(key => `${key} = ?`).join(', ');
        const values = keys.map(key => req.body[key]);
        values.push(req.params.id);

        await pool.query(`UPDATE magzine SET ${updates}, updated_at = NOW() WHERE id = ?`, values);
        const [rows] = await pool.query('SELECT * FROM magzine WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Magazine not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating magazine:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a magazine
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM magzine WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Magazine not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
