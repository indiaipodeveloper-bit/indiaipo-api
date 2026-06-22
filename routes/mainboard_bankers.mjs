import express from "express";
import pool from "../db.mjs";

const router = express.Router();

// Utility to extract number from strings like "₹3,49,962.23 Cr"
const cleanNumeric = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove everything except digits, decimal point, and minus sign
  const cleaned = val.toString().replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// GET all mainboard bankers with search and pagination
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const mcat_id = req.query.category || 'list-of-mainboard-merchant-bankers';
    let countQuery = "SELECT COUNT(*) as total FROM marchantbankers WHERE mcat_id = ?";
    let dataQuery = "SELECT * FROM marchantbankers WHERE mcat_id = ?";
    const queryParams = [mcat_id];

    if (search) {
      const searchClause = " AND (title LIKE ? OR description LIKE ? OR slug LIKE ?)";
      countQuery += searchClause;
      dataQuery += searchClause;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    dataQuery += " ORDER BY id DESC LIMIT ? OFFSET ?";
    const dataParams = [...queryParams, limit, offset];

    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;
    
    const [data] = await pool.query(dataQuery, dataParams);

    // Keep original data but add mapped fields for backward compatibility if needed by frontend
    const mappedData = data.map(row => ({
      ...row,
      name: row.title || "Unknown Banker",
      logo_url: row.image ? (row.image.startsWith('/') ? row.image : '/' + row.image) : null,
      total_ipos: cleanNumeric(row.noOfiposofar),
      total_raised: cleanNumeric(row.totalfundraised),
      avg_size: cleanNumeric(row.avgiposize),
      avg_subscription: cleanNumeric(row.avgsubscription),
      website: row.cweblink || "",
      location: row.caddress || "",
      sebi_registration: row.slug || "",
      is_active: 1
    }));

    res.json({
      data: mappedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching mainboard bankers:", error);
    res.status(500).json({ error: "Failed to fetch mainboard bankers" });
  }
});

// GET single mainboard banker by ID
router.get("/:id", async (req, res) => {
  try {
    const [data] = await pool.query(
      "SELECT * FROM marchantbankers WHERE id = ?",
      [req.params.id]
    );
    if (data.length === 0) return res.status(404).json({ error: "Banker not found" });
    
    const row = data[0];
    res.json({
      ...row,
      name: row.title || "Unknown Banker",
      logo_url: row.image ? (row.image.startsWith('/') ? row.image : '/' + row.image) : null,
      total_ipos: cleanNumeric(row.noOfiposofar),
      total_raised: cleanNumeric(row.totalfundraised),
      avg_size: cleanNumeric(row.avgiposize),
      avg_subscription: cleanNumeric(row.avgsubscription),
      website: row.cweblink || "",
      location: row.caddress || "",
      sebi_registration: row.slug || "",
      is_active: 1
    });
  } catch (error) {
    console.error("Error fetching single mainboard banker:", error);
    res.status(500).json({ error: "Failed to fetch banker" });
  }
});

// GET single mainboard banker by slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const [data] = await pool.query(
      "SELECT * FROM marchantbankers WHERE slug = ? AND mcat_id = 'list-of-mainboard-merchant-bankers'",
      [req.params.slug]
    );
    if (data.length === 0) return res.status(404).json({ error: "Banker not found" });
    
    const row = data[0];
    res.json({
      ...row,
      name: row.title || "Unknown Banker",
      logo_url: row.image ? (row.image.startsWith('/') ? row.image : '/' + row.image) : null,
      total_ipos: cleanNumeric(row.noOfiposofar),
      total_raised: cleanNumeric(row.totalfundraised),
      avg_size: cleanNumeric(row.avgiposize),
      avg_subscription: cleanNumeric(row.avgsubscription),
      website: row.cweblink || "",
      location: row.caddress || "",
      sebi_registration: row.slug || "",
      is_active: 1
    });
  } catch (error) {
    console.error("Error fetching single mainboard banker by slug:", error);
    res.status(500).json({ error: "Failed to fetch banker" });
  }
});

// POST new mainboard banker
router.post("/", async (req, res) => {
  try {
    const fields = [
      'title', 'sub_title', 'slug', 'mcat_id', 'image', 'description', 
      'meta_title', 'meta_desc', 'meta_keywords', 'noOfiposofar', 'ipos', 
      'totalfundraised', 'avgiposize', 'avglisting_gain', 'avgsubscription', 'faqs',
      'nseemer', 'bsesme', 'yearwise_ipolisting', 'sme_ipos_by_size', 'sme_ipos_by_subscription',
      'cemail', 'cmobile', 'caddress', 'cweblink', 'established_year'
    ];

    const { established_year, cemail, cmobile } = req.body;
    if (established_year && !/^\d+$/.test(String(established_year))) {
      return res.status(400).json({ error: "Established Year must contain only numbers" });
    }
    if (cemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }
    if (cmobile && !/^\d{10}$/.test(cmobile)) {
      return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
    }

    const insertFields = [];
    const placeholders = [];
    const values = [];

    // Force mcat_id for mainboard
    req.body.mcat_id = 'list-of-mainboard-merchant-bankers';

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        insertFields.push(field);
        placeholders.push('?');
        values.push(req.body[field]);
      }
    });

    if (insertFields.length === 0) {
      return res.status(400).json({ error: "No fields provided" });
    }

    const query = `INSERT INTO marchantbankers (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await pool.query(query, values);
    res.status(201).json({ id: result.insertId, message: "Mainboard banker created successfully" });
  } catch (error) {
    console.error("Error creating mainboard banker:", error);
    res.status(500).json({ error: "Failed to create banker" });
  }
});

// PUT update existing mainboard banker
router.put("/:id", async (req, res) => {
  try {
    const fields = [
      'title', 'sub_title', 'slug', 'mcat_id', 'image', 'description', 
      'meta_title', 'meta_desc', 'meta_keywords', 'noOfiposofar', 'ipos', 
      'totalfundraised', 'avgiposize', 'avglisting_gain', 'avgsubscription', 'faqs',
      'nseemer', 'bsesme', 'yearwise_ipolisting', 'sme_ipos_by_size', 'sme_ipos_by_subscription',
      'cemail', 'cmobile', 'caddress', 'cweblink', 'established_year'
    ];

    const { established_year, cemail, cmobile } = req.body;
    if (established_year && !/^\d+$/.test(String(established_year))) {
      return res.status(400).json({ error: "Established Year must contain only numbers" });
    }
    if (cemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }
    if (cmobile && !/^\d{10}$/.test(cmobile)) {
      return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
    }

    const updateFields = [];
    const values = [];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);
    const query = `UPDATE marchantbankers SET ${updateFields.join(', ')} WHERE id = ? AND mcat_id = 'list-of-mainboard-merchant-bankers'`;

    const [result] = await pool.query(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Banker not found in Mainboard list" });
    }
    res.json({ message: "Mainboard banker updated successfully" });
  } catch (error) {
    console.error("Error updating mainboard banker:", error);
    res.status(500).json({ error: "Failed to update banker" });
  }
});


// DELETE mainboard banker
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM marchantbankers WHERE id = ? AND mcat_id = 'list-of-mainboard-merchant-bankers'", 
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Banker not found" });
    }
    res.json({ message: "Mainboard banker deleted successfully" });
  } catch (error) {
    console.error("Error deleting mainboard banker:", error);
    res.status(500).json({ error: "Failed to delete banker" });
  }
});

export default router;
