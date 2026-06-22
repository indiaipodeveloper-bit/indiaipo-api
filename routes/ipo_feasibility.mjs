import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';

const router = express.Router();

// Ensure table exists (though it usually already does based on user info)
const initTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS check_ipo_eligibility (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        current_turn_over VARCHAR(255),
        current_pat VARCHAR(255),
        industry VARCHAR(255),
        business_type VARCHAR(255),
        networth VARCHAR(255),
        profit VARCHAR(255),
        vintage VARCHAR(255),
        eligibility VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ 'check_ipo_eligibility' table verified");
  } catch (err) {
    console.error("❌ Error verifying 'check_ipo_eligibility' table:", err.message);
  }
};

initTable();

// GET all feasibility enquiries with pagination and search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE name LIKE ? OR email LIKE ? OR company_name LIKE ? OR mobile LIKE ?';
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern, searchPattern, searchPattern];
    }

    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM check_ipo_eligibility ${whereClause}`, params);
    const total = countResult[0].total;

    // Add limit and offset to params
    const queryParams = [...params, limit, offset];
    const [rows] = await pool.query(
      `SELECT * FROM check_ipo_eligibility ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    res.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Error fetching ipo feasibility entries:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new feasibility enquiry
router.post('/', verifyRecaptcha('ipo_feasibility_form'), async (req, res) => {
  try {
    const {
      name, mobile, email, company_name,
      current_turn_over, current_pat, industry,
      business_type, networth, profit, vintage, eligibility
    } = req.body;

    // Validate required fields
    if (!name || !email || !mobile) {
      return res.status(400).json({ error: 'Name, email, and mobile are required' });
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        error: "Mobile number must be exactly 10 digits (numbers only)"
      });
    }

    const [result] = await pool.query(
      `INSERT INTO check_ipo_eligibility 
      (name, mobile, email, company_name, current_turn_over, current_pat, industry, business_type, networth, profit, vintage, eligibility) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile, email, company_name, current_turn_over, current_pat, industry, business_type, networth, profit, vintage, eligibility || 'Pending']
    );

    res.status(201).json({ id: result.insertId, message: "Enquiry submitted successfully" });
  } catch (err) {
    console.error("Error creating ipo feasibility entry:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a feasibility enquiry
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM check_ipo_eligibility WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json({ message: "Entry deleted successfully" });
  } catch (err) {
    console.error("Error deleting ipo feasibility entry:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
