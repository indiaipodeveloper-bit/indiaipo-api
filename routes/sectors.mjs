import express from "express";
import pool from "../db.mjs";

const router = express.Router();

// GET all sectors with IPO counts
router.get("/", async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    let query = `
      SELECT 
        s.*,
        COUNT(CASE WHEN LOWER(i.type) = 'mainline' THEN 1 END) as mainline_count,
        COUNT(CASE WHEN LOWER(i.type) = 'sme' THEN 1 END) as sme_count,
        COUNT(i.id) as total_count
      FROM sectors s
      LEFT JOIN sector_by_ipo i ON s.id = i.sector_id
      WHERE s.status = 'Active'
    `;
    const params = [];
    if (search) {
      query += " AND s.name LIKE ?";
      params.push(`%${search}%`);
    }
    query += `
      GROUP BY s.id
      ORDER BY s.name ASC
    `;
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching sectors with counts:", error);
    res.status(500).json({ error: "Failed to fetch sector data" });
  }
});

// GET all sectors for admin (includes inactive)
router.get("/admin", async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const search = req.query.search ? req.query.search.trim() : "";

    let countQuery = "SELECT COUNT(*) as total FROM sectors s";
    let query = `
      SELECT 
        s.*,
        COUNT(CASE WHEN LOWER(i.type) = 'mainline' THEN 1 END) as mainline_count,
        COUNT(CASE WHEN LOWER(i.type) = 'sme' THEN 1 END) as sme_count,
        COUNT(i.id) as total_count
      FROM sectors s
      LEFT JOIN sector_by_ipo i ON s.id = i.sector_id
    `;

    const whereClause = [];
    const params = [];

    if (search) {
      whereClause.push("s.name LIKE ?");
      params.push(`%${search}%`);
    }

    if (whereClause.length > 0) {
      const clause = " WHERE " + whereClause.join(" AND ");
      countQuery += clause;
      query += clause;
    }

    query += " GROUP BY s.id ORDER BY s.name ASC";

    if (page !== null && limit !== null) {
      const [countResult] = await pool.query(countQuery, params);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      
      const [rows] = await pool.query(query, [...params, limit, offset]);
      
      res.json({
        sectors: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } else {
      const [rows] = await pool.query(query, params);
      res.json(rows);
    }
  } catch (error) {
    console.error("Error fetching sectors for admin:", error);
    res.status(500).json({ error: "Failed to fetch sectors" });
  }
});

// Helper to validate numeric strings
const validateNumeric = (val, fieldName) => {
  if (val === undefined || val === null || val === "" || String(val).trim() === "") {
    return 0; // Optional fields default to 0
  }
  const cleanVal = String(val).replace(/,/g, "").trim();
  const num = parseFloat(cleanVal);
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return num;
};

// POST new sector
router.post("/", async (req, res) => {
  try {
    const { 
      name, description, status,
      pe_heigest, pe_median, pe_lowest,
      ipo_size_heigest, ipo_size_median, ipo_size_lowest,
      mainline_pe_heigest, mainline_pe_median, mainline_pe_lowest,
      mainline_ipo_size_heigest, mainline_ipo_size_median, mainline_ipo_size_lowest
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Sector name is required" });
    }

    try {
      const data = [
        name.trim(), description || "", status || 'Active',
        validateNumeric(pe_heigest, "P/E Highest"),
        validateNumeric(pe_median, "P/E Median"),
        validateNumeric(pe_lowest, "P/E Lowest"),
        validateNumeric(ipo_size_heigest, "IPO Size Highest"),
        validateNumeric(ipo_size_median, "IPO Size Median"),
        validateNumeric(ipo_size_lowest, "IPO Size Lowest"),
        validateNumeric(mainline_pe_heigest, "Mainboard P/E Highest"),
        validateNumeric(mainline_pe_median, "Mainboard P/E Median"),
        validateNumeric(mainline_pe_lowest, "Mainboard P/E Lowest"),
        validateNumeric(mainline_ipo_size_heigest, "Mainboard IPO Size Highest"),
        validateNumeric(mainline_ipo_size_median, "Mainboard IPO Size Median"),
        validateNumeric(mainline_ipo_size_lowest, "Mainboard IPO Size Lowest")
      ];

      const query = `
        INSERT INTO sectors (
          name, description, status, 
          pe_heigest, pe_median, pe_lowest, 
          ipo_size_heigest, ipo_size_median, ipo_size_lowest,
          mainline_pe_heigest, mainline_pe_median, mainline_pe_lowest,
          mainline_ipo_size_heigest, mainline_ipo_size_median, mainline_ipo_size_lowest
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await pool.query(query, data);
      res.status(201).json({ id: result.insertId, message: "Sector created successfully" });
    } catch (valError) {
      return res.status(400).json({ error: valError.message });
    }
  } catch (error) {
    console.error("Error creating sector:", error);
    res.status(500).json({ error: "Failed to create sector" });
  }
});

// PUT update sector
router.put("/:id", async (req, res) => {
  try {
    const { 
      name, description, status,
      pe_heigest, pe_median, pe_lowest,
      ipo_size_heigest, ipo_size_median, ipo_size_lowest,
      mainline_pe_heigest, mainline_pe_median, mainline_pe_lowest,
      mainline_ipo_size_heigest, mainline_ipo_size_median, mainline_ipo_size_lowest
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Sector name is required" });
    }

    try {
      const data = [
        name.trim(), description || "", status,
        validateNumeric(pe_heigest, "P/E Highest"),
        validateNumeric(pe_median, "P/E Median"),
        validateNumeric(pe_lowest, "P/E Lowest"),
        validateNumeric(ipo_size_heigest, "IPO Size Highest"),
        validateNumeric(ipo_size_median, "IPO Size Median"),
        validateNumeric(ipo_size_lowest, "IPO Size Lowest"),
        validateNumeric(mainline_pe_heigest, "Mainboard P/E Highest"),
        validateNumeric(mainline_pe_median, "Mainboard P/E Median"),
        validateNumeric(mainline_pe_lowest, "Mainboard P/E Lowest"),
        validateNumeric(mainline_ipo_size_heigest, "Mainboard IPO Size Highest"),
        validateNumeric(mainline_ipo_size_median, "Mainboard IPO Size Median"),
        validateNumeric(mainline_ipo_size_lowest, "Mainboard IPO Size Lowest"),
        req.params.id
      ];

      const query = `
        UPDATE sectors SET 
          name = ?, description = ?, status = ?,
          pe_heigest = ?, pe_median = ?, pe_lowest = ?,
          ipo_size_heigest = ?, ipo_size_median = ?, ipo_size_lowest = ?,
          mainline_pe_heigest = ?, mainline_pe_median = ?, mainline_pe_lowest = ?,
          mainline_ipo_size_heigest = ?, mainline_ipo_size_median = ?, mainline_ipo_size_lowest = ?
        WHERE id = ?
      `;

      await pool.query(query, data);
      res.json({ message: "Sector updated successfully" });
    } catch (valError) {
      return res.status(400).json({ error: valError.message });
    }
  } catch (error) {
    console.error("Error updating sector:", error);
    res.status(500).json({ error: "Failed to update sector" });
  }
});

// DELETE sector
router.delete("/:id", async (req, res) => {
  try {
    // Check if sector is in use in sector-wise IPO records
    const [inUse] = await pool.query("SELECT id FROM sector_by_ipo WHERE sector_id = ? LIMIT 1", [req.params.id]);
    if (inUse.length > 0) {
      return res.status(400).json({ error: "Cannot delete sector as it is currently linked to one or more IPOs" });
    }
    
    // Disassociate this sector from any primary IPOs in the main ipo_lists table
    await pool.query("UPDATE ipo_lists SET sector_id = NULL WHERE sector_id = ?", [req.params.id]);
    
    // Clear links in ipo_sector_links mapping table
    await pool.query("DELETE FROM ipo_sector_links WHERE sector_id = ?", [req.params.id]);

    // Delete the sector
    await pool.query("DELETE FROM sectors WHERE id = ?", [req.params.id]);
    res.json({ message: "Sector deleted successfully" });
  } catch (error) {
    console.error("Error deleting sector:", error);
    res.status(500).json({ error: "Failed to delete sector" });
  }
});

// ==========================================
// SECTOR BY IPO (CRUD)
// ==========================================

// GET all sector-wise IPO records
router.get("/ipos/list", async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const search = req.query.search ? req.query.search.trim() : "";

    let countQuery = "SELECT COUNT(*) as total FROM sector_by_ipo i";
    let query = `
      SELECT 
        i.*,
        s.name AS sector_name,
        b.title AS blog_title
      FROM sector_by_ipo i
      LEFT JOIN sectors s ON i.sector_id = s.id
      LEFT JOIN admin_blogs b ON i.admin_blog_id = b.id
    `;

    const whereClause = [];
    const params = [];

    if (search) {
      whereClause.push("i.name LIKE ?");
      params.push(`%${search}%`);
    }

    if (whereClause.length > 0) {
      const clause = " WHERE " + whereClause.join(" AND ");
      countQuery += clause;
      query += clause;
    }

    query += " ORDER BY i.id DESC";

    if (page !== null && limit !== null) {
      const [countResult] = await pool.query(countQuery, params);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      
      const [rows] = await pool.query(query, [...params, limit, offset]);
      
      res.json({
        sectorIpos: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } else {
      const [rows] = await pool.query(query, params);
      res.json(rows);
    }
  } catch (error) {
    console.error("Error fetching sector-wise IPOs:", error);
    res.status(500).json({ error: "Failed to fetch sector IPOs" });
  }
});

// GET single sector-wise IPO record by ID
router.get("/ipos/:id", async (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        s.name AS sector_name,
        b.title AS blog_title,
        COALESCE(NULLIF(b.new_slug, ''), b.slug) as blog_slug
      FROM sector_by_ipo i
      LEFT JOIN sectors s ON i.sector_id = s.id
      LEFT JOIN admin_blogs b ON i.admin_blog_id = b.id
      WHERE i.id = ?
    `;
    const [rows] = await pool.query(query, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Sector IPO not found" });
    }
    
    const item = rows[0];
    Object.keys(item).forEach(key => {
      if (item[key] === null) item[key] = 0;
    });

    res.json(item);
  } catch (error) {
    console.error("Error fetching single sector-wise IPO:", error);
    res.status(500).json({ error: "Failed to fetch sector-wise IPO" });
  }
});

// POST create new sector-wise IPO record
router.post("/ipos/create", async (req, res) => {
  try {
    const { 
      name, type, ipo_year, iposize, sector_id, pe_ratio, admin_blog_id, status 
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }
    if (!type || (type !== "SME" && type !== "MAINLINE")) {
      return res.status(400).json({ error: "Type must be either SME or MAINLINE" });
    }

    const data = [
      name.trim(),
      type,
      ipo_year || null,
      iposize || null,
      sector_id || null,
      pe_ratio || null,
      admin_blog_id || null,
      status || 'Active',
      new Date().toISOString().slice(0, 19).replace('T', ' '),
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ];

    const query = `
      INSERT INTO sector_by_ipo (
        name, type, ipo_year, iposize, sector_id, pe_ratio, admin_blog_id, status, created_at, update_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, data);
    res.status(201).json({ id: result.insertId, message: "Sector IPO created successfully" });
  } catch (error) {
    console.error("Error creating sector IPO:", error);
    res.status(500).json({ error: "Failed to create sector IPO" });
  }
});

// PUT update existing sector-wise IPO record
router.put("/ipos/:id", async (req, res) => {
  try {
    const { 
      name, type, ipo_year, iposize, sector_id, pe_ratio, admin_blog_id, status 
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }
    if (!type || (type !== "SME" && type !== "MAINLINE")) {
      return res.status(400).json({ error: "Type must be either SME or MAINLINE" });
    }

    const data = [
      name.trim(),
      type,
      ipo_year || null,
      iposize || null,
      sector_id || null,
      pe_ratio || null,
      admin_blog_id || null,
      status || 'Active',
      new Date().toISOString().slice(0, 19).replace('T', ' '),
      req.params.id
    ];

    const query = `
      UPDATE sector_by_ipo SET 
        name = ?,
        type = ?,
        ipo_year = ?,
        iposize = ?,
        sector_id = ?,
        pe_ratio = ?,
        admin_blog_id = ?,
        status = ?,
        update_at = ?
      WHERE id = ?
    `;

    await pool.query(query, data);
    res.json({ message: "Sector IPO updated successfully" });
  } catch (error) {
    console.error("Error updating sector IPO:", error);
    res.status(500).json({ error: "Failed to update sector IPO" });
  }
});

// DELETE sector-wise IPO record
router.delete("/ipos/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM sector_by_ipo WHERE id = ?", [req.params.id]);
    res.json({ message: "Sector IPO deleted successfully" });
  } catch (error) {
    console.error("Error deleting sector IPO:", error);
    res.status(500).json({ error: "Failed to delete sector IPO" });
  }
});

export default router;
