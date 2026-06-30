import express from "express";
import pool from "../db.mjs";

const router = express.Router();


const isValidDate = (date) => {
  return !isNaN(Date.parse(date));
};

const isValidNumber = (num) => {
  return !isNaN(num) && num !== null;
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};



// GET all IPOs with search, filter and pagination

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const admin = req.query.admin || "";
    let limitInput = parseInt(req.query.limit);
    if (isNaN(limitInput) || limitInput <= 0) {
      limitInput = 15;
    }

    let limit;
    if (admin === "true") {
      limit = Math.min(limitInput, 1000);
    } else {
      if (limitInput > 500) {
        limit = 500;
      } else {
        limit = limitInput;
      }
    }
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const upcoming = req.query.upcoming || "";
    const status = req.query.status || "";
    const sector_name = req.query.sector_name || "";
    const by_sector = req.query.by_sector || "";
    const sector_id_param = req.query.sector_id || "";
    const admin_blog_id = req.query.admin_blog_id || "";

    if (by_sector === "true") {
      const combinedSubquery = `
        SELECT 
          CAST(i.id AS UNSIGNED) as id,
          CAST(i.issuer_company AS CHAR) COLLATE utf8mb4_general_ci as issuer_company,
          CAST(i.issue_category AS CHAR) COLLATE utf8mb4_general_ci as issue_category,
          CAST(i.issue_size AS CHAR) COLLATE utf8mb4_general_ci as issue_size,
          CAST(i.ipo_pe_ratio AS CHAR) COLLATE utf8mb4_general_ci as ipo_pe_ratio,
          i.open_date as open_date,
          CAST(i.admin_blog_id AS UNSIGNED) as admin_blog_id,
          CAST(i.status AS CHAR) COLLATE utf8mb4_general_ci as status,
          CAST(s_link.id AS UNSIGNED) as sector_id
        FROM ipo_lists i
        JOIN ipo_sector_links isl ON i.id = isl.ipo_id
        JOIN sectors s_link ON isl.sector_id = s_link.id

        UNION ALL

        SELECT 
          CAST(i.id AS UNSIGNED) as id,
          CAST(i.issuer_company AS CHAR) COLLATE utf8mb4_general_ci as issuer_company,
          CAST(i.issue_category AS CHAR) COLLATE utf8mb4_general_ci as issue_category,
          CAST(i.issue_size AS CHAR) COLLATE utf8mb4_general_ci as issue_size,
          CAST(i.ipo_pe_ratio AS CHAR) COLLATE utf8mb4_general_ci as ipo_pe_ratio,
          i.open_date as open_date,
          CAST(i.admin_blog_id AS UNSIGNED) as admin_blog_id,
          CAST(i.status AS CHAR) COLLATE utf8mb4_general_ci as status,
          CAST(s_link.id AS UNSIGNED) as sector_id
        FROM ipo_lists i
        JOIN sectors s_link ON i.sector_id = s_link.id
        LEFT JOIN ipo_sector_links isl ON i.id = isl.ipo_id
        WHERE isl.ipo_id IS NULL

        UNION ALL

        SELECT 
          CAST(i.id AS UNSIGNED) as id,
          CAST(i.name AS CHAR) COLLATE utf8mb4_general_ci as issuer_company,
          CAST(i.type AS CHAR) COLLATE utf8mb4_general_ci as issue_category,
          CAST(i.iposize AS CHAR) COLLATE utf8mb4_general_ci as issue_size,
          CAST(i.pe_ratio AS CHAR) COLLATE utf8mb4_general_ci as ipo_pe_ratio,
          i.ipo_year as open_date,
          CAST(i.admin_blog_id AS UNSIGNED) as admin_blog_id,
          CAST(i.status AS CHAR) COLLATE utf8mb4_general_ci as status,
          CAST(i.sector_id AS UNSIGNED) as sector_id
        FROM sector_by_ipo i
        WHERE NOT EXISTS (
          SELECT 1 FROM ipo_lists il 
          WHERE (LOWER(TRIM(il.issuer_company)) COLLATE utf8mb4_general_ci) = (LOWER(TRIM(i.name)) COLLATE utf8mb4_general_ci)
        )
      `;

      let countQuery = `
        SELECT COUNT(DISTINCT i.id) as total 
        FROM (${combinedSubquery}) i
        LEFT JOIN sectors s ON i.sector_id = s.id
      `;
      let dataQuery = `
        SELECT i.id,
               i.issuer_company,
               i.issue_category,
               i.issue_size,
               i.ipo_pe_ratio,
               i.open_date,
               i.admin_blog_id,
               s.name AS sector_name,
               s.name AS sector_names,
               COALESCE(NULLIF(b.new_slug, ''), b.slug) as blog_slug
        FROM (${combinedSubquery}) i
        LEFT JOIN sectors s ON i.sector_id = s.id
        LEFT JOIN admin_blogs b ON i.admin_blog_id = b.id
      `;
      const queryParams = [];
      const whereClauses = [];

      let sectorsList = [];
      if (sector_name) {
        sectorsList = sector_name.split(",").map(s => s.trim()).filter(Boolean);
        if (sectorsList.length > 0) {
          const placeholders = sectorsList.map(() => "?").join(",");
          whereClauses.push(`s.name IN (${placeholders})`);
          queryParams.push(...sectorsList);
        }
      }

      if (search) {
        whereClauses.push("i.issuer_company LIKE ?");
        queryParams.push(`%${search}%`);
      }

      if (category) {
        whereClauses.push("LOWER(i.issue_category) = LOWER(?)");
        queryParams.push(category);
      }

      whereClauses.push("i.status = 'Active'");

      if (whereClauses.length > 0) {
        const whereString = " WHERE " + whereClauses.join(" AND ");
        countQuery += whereString;
        dataQuery += whereString;
      }

      let orderBySql = " ORDER BY s.name ASC, i.issuer_company ASC";
      const orderParams = [];
      if (sectorsList.length > 0) {
        const fieldPlaceholders = sectorsList.map(() => "?").join(",");
        orderBySql = ` ORDER BY FIELD(s.name, ${fieldPlaceholders}) = 0 ASC, FIELD(s.name, ${fieldPlaceholders}) ASC, i.issuer_company ASC`;
        orderParams.push(...sectorsList, ...sectorsList);
      }

      dataQuery += orderBySql + " LIMIT ? OFFSET ?";
      const dataParams = [...queryParams, ...orderParams, limit, offset];

      const [[{ total }]] = await pool.query(countQuery, queryParams);
      const [data] = await pool.query(dataQuery, dataParams);

      const processedData = data.map(item => {
        const processed = { ...item };
        const excludeFromZero = ['logo', 'blog_image', 'blog_slug', 'sector_name', 'sector_names', 'issuer_company', 'status', 'issue_category', 'date_declared', 'open_date', 'close_date', 'listing_date', 'merchant_bankers', 'exchange', 'ipo_subscription', 'listing_day_gain_percentage', 'listing_price'];

        Object.keys(processed).forEach(key => {
          if (processed[key] === null && !excludeFromZero.includes(key)) {
            processed[key] = 0;
          }
        });
        return processed;
      });

      return res.json({
        data: processedData,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    let countQuery = `
      SELECT COUNT(DISTINCT i.id) as total 
      FROM ipo_lists i
      LEFT JOIN ipo_sector_links isl ON i.id = isl.ipo_id
      LEFT JOIN sectors s ON isl.sector_id = s.id
    `;
    let dataQuery = `
      SELECT i.*, 
             GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') AS sector_names,
             GROUP_CONCAT(DISTINCT isl.sector_id) AS sector_ids,
             b.image AS blog_image,
             b.gmp AS gmp_history,
             COALESCE(NULLIF(b.new_slug, ''), b.slug) as blog_slug,
             b.ipo_subscription AS ipo_subscription
      FROM ipo_lists i 
      LEFT JOIN ipo_sector_links isl ON i.id = isl.ipo_id
      LEFT JOIN sectors s ON isl.sector_id = s.id
      LEFT JOIN admin_blogs b ON i.admin_blog_id = b.id
    `;
    const queryParams = [];
    const whereClauses = [];

    if (sector_name) {
      const sectorsList = sector_name.split(",").map(s => s.trim()).filter(Boolean);
      if (sectorsList.length > 0) {
        const placeholders = sectorsList.map(() => "?").join(",");
        whereClauses.push(`s.name IN (${placeholders})`);
        queryParams.push(...sectorsList);
      }
    }

    if (search) {
      whereClauses.push("(i.issuer_company LIKE ? OR i.merchant_bankers LIKE ? OR i.exchange LIKE ?)");
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      whereClauses.push("i.issue_category = ?");
      queryParams.push(category);
    }

    if (admin === "true" || admin_blog_id || sector_id_param) {
      if (upcoming) {
        whereClauses.push("i.upcoming = ?");
        queryParams.push(upcoming);
      }
    } else {
      whereClauses.push("i.upcoming = '0'");
    }

    if (sector_id_param) {
      whereClauses.push("(isl.sector_id = ? OR i.sector_id = ?)");
      queryParams.push(sector_id_param, sector_id_param);
    }

    if (admin_blog_id) {
      whereClauses.push("i.admin_blog_id = ?");
      queryParams.push(admin_blog_id);
    }

    if (status) {

      if (status === 'Upcoming') {

        whereClauses.push(`
      DATE(i.open_date) > CURDATE()
      AND i.status != 'Inactive'
    `);

      } else if (status === 'Issue Closed (Unlisted)' || status === 'Closed') {

        whereClauses.push(`
      DATE(i.close_date) < CURDATE()
      AND (
        i.listing_date IS NULL
        OR CURDATE() < DATE(i.listing_date)
      )
      AND i.status != 'Inactive'
    `);

      } else if (status === 'Listing Today') {

        whereClauses.push(`
      DATE(i.listing_date) = CURDATE()
      AND i.status != 'Inactive'
    `);

      } else if (status === 'Listed') {

        whereClauses.push(`
      DATE(i.listing_date) < CURDATE()
      AND i.status != 'Inactive'
    `);

      } else if (status === 'Active' || status === 'Open') {

        whereClauses.push(`
      CURDATE() BETWEEN DATE(i.open_date) AND DATE(i.close_date)
      AND i.status != 'Inactive'
    `);

      } else {

        whereClauses.push("i.status = ?");
        queryParams.push(status);

      }

    }
    if (whereClauses.length > 0) {
      const whereString = " WHERE " + whereClauses.join(" AND ");
      countQuery += whereString;
      dataQuery += whereString;
    }

    const sortField = req.query.sort || "id";
    const allowedSortFields = ["id", "issuer_company", "sector_name", "listing_date", "gmp"];
    const finalSortField = allowedSortFields.includes(sortField) ? sortField : "id";
    const sortFieldSql = finalSortField === "sector_name" ? "s.name" : (finalSortField === "id" ? "i.id" : finalSortField);

    // Complex Sorting Priority:
    // 1. Date Not Declared AND Upcoming=1
    // 2. Upcoming (open_date > curdate)
    // 3. Open/Active (open_date <= curdate and close_date >= curdate)
    // 4. Listing Today (listing_date = curdate)
    // 5. Closed (Unlisted) (close_date < curdate and (listing_date IS NULL OR listing_date > curdate))
    // 6. Already Listed (listing_date < curdate)
    // 7. Rest (including Date Not Declared but not upcoming)
    const prioritySql = `
      CASE 
        WHEN (COALESCE(i.date_declared, '0') = '0' OR i.date_declared = 'No' OR i.date_declared = 'Date Not Declared' OR COALESCE(i.date_declared, '') = '') AND i.upcoming = '1' THEN 1
        WHEN i.open_date > CURRENT_DATE() THEN 2
        WHEN i.open_date <= CURRENT_DATE() AND i.close_date >= CURRENT_DATE() THEN 3
      
        WHEN i.close_date < CURRENT_DATE() AND (i.listing_date IS NULL OR i.listing_date > CURRENT_DATE()) THEN 4
        WHEN i.listing_date = CURRENT_DATE() THEN 5
        WHEN i.listing_date IS NOT NULL AND i.listing_date < CURRENT_DATE() THEN 6
        ELSE 7
      END
    `;

    dataQuery += ` 
      GROUP BY i.id
      ORDER BY 
        ${prioritySql} ASC, 
        (CASE WHEN (${prioritySql}) = 1 THEN i.id END) DESC,
        (CASE WHEN (${prioritySql}) = 2 THEN COALESCE(i.listing_date, i.close_date) END) DESC,
        (CASE WHEN (${prioritySql}) = 3 THEN COALESCE(i.listing_date, i.close_date) END) DESC,
        (CASE WHEN (${prioritySql}) = 4 THEN COALESCE(i.listing_date, i.close_date) END) DESC,
        (CASE WHEN (${prioritySql}) = 5 THEN i.close_date END) DESC,
        (CASE WHEN (${prioritySql}) = 6 THEN i.listing_date END) DESC,
        i.id DESC 
      LIMIT ? OFFSET ?`;
    const dataParams = [...queryParams, limit, offset];

    const [[{ total }]] = await pool.query(countQuery, queryParams);
    const [data] = await pool.query(dataQuery, dataParams);

    // Map nulls (only for numeric indicators, keep paths/slugs as null or empty)
    const processedData = data.map(item => {
      const processed = { ...item };
      const excludeFromZero = ['logo', 'blog_image', 'blog_slug', 'sector_name', 'sector_names', 'issuer_company', 'status', 'issue_category', 'date_declared', 'open_date', 'close_date', 'listing_date', 'merchant_bankers', 'exchange', 'ipo_subscription', 'listing_day_gain_percentage', 'listing_price'];

      Object.keys(processed).forEach(key => {
        if (processed[key] === null && !excludeFromZero.includes(key)) {
          processed[key] = 0;
        }
      });
      return processed;
    });

    res.json({
      data: processedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching IPO lists:", error);
    res.status(500).json({ error: "Failed to fetch IPO lists" });
  }
});

// GET sectors (for dropdown in admin)
router.get("/sectors/list", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name AS sector_name FROM sectors ORDER BY name ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch sectors" });
  }
});

// GET single IPO by ID
router.get("/:id", async (req, res) => {
  try {
    const [data] = await pool.query("SELECT * FROM ipo_lists WHERE id = ?", [req.params.id]);
    if (data.length === 0) {
      return res.status(404).json({ error: "IPO not found" });
    }

    const item = data[0];
    const excludeFromZero = ['logo', 'blog_image', 'blog_slug', 'sector_name', 'sector_names', 'issuer_company', 'status', 'issue_category', 'date_declared', 'open_date', 'close_date', 'listing_date', 'merchant_bankers', 'exchange', 'ipo_subscription', 'listing_day_gain_percentage', 'listing_price'];
    Object.keys(item).forEach(key => {
      if (item[key] === null && !excludeFromZero.includes(key)) item[key] = 0;
    });

    res.json(item);
  } catch (error) {
    console.error("Error fetching single IPO:", error);
    res.status(500).json({ error: "Failed to fetch IPO" });
  }
});

// POST new IPO
router.post("/", async (req, res) => {
  try {
    let {
      logo, issuer_company, date_declared, open_date, close_date,
      listing_date, merchant_bankers, issue_lowest_price, issue_highest_price,
      issue_size, lot_size, exchange, gmp, issue_category, sector_id,
      merchant_banker, current_price, ipo_pe_ratio, listing_day_close_bse,
      listing_day_close_nse, listing_day_open_bse, listing_day_open_nse, status, upcoming, confidential,
      upcoming_ipo_status, admin_blog_id, sector_ids, listing_day_gain_percentage, listing_price
    } = req.body;

    // Resolve merchant_bankers names from merchant_banker IDs
    if (merchant_banker) {
      const idArray = String(merchant_banker).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (idArray.length > 0) {
        const [bankersRows] = await pool.query(`SELECT title FROM marchantbankers WHERE id IN (${idArray.join(',')})`);
        merchant_bankers = bankersRows.map(r => r.title).join(', ');
      } else {
        merchant_bankers = null;
      }
    } else {
      merchant_bankers = null;
    }

    // =========================
    // ✅ REQUIRED VALIDATION
    // =========================

    if (!issuer_company || String(issuer_company).trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }

    if (!exchange || String(exchange).trim() === "") {
      return res.status(400).json({ error: "Exchange is required" });
    }

    if (!issue_category) {
      return res.status(400).json({ error: "Issue category required" });
    }

    // =========================
    // ✅ DATE LOGIC & VALIDATION
    // =========================

    if (date_declared === "Yes" || date_declared === "1" || date_declared === 1) {
      if (!open_date || isNaN(Date.parse(open_date))) {
        return res.status(400).json({ error: "Valid open date required when date is declared" });
      }

      if (!close_date || isNaN(Date.parse(close_date))) {
        return res.status(400).json({ error: "Valid close date required when date is declared" });
      }

      if (new Date(close_date) < new Date(open_date)) {
        return res.status(400).json({ error: "Close date must be after open date" });
      }

      if (listing_date && new Date(listing_date) < new Date(close_date)) {
        return res.status(400).json({ error: "Listing date must be after close date" });
      }
    } else {
      // Clear dates if not declared
      open_date = null;
      close_date = null;
      listing_date = null;
    }

    // =========================
    // ✅ LOT SIZE
    // =========================

    lot_size = Number(lot_size);
    if (isNaN(lot_size) || lot_size < 0) {
      lot_size = 0;
    }

    // =========================
    // ✅ PRICE VALIDATION
    // =========================

    issue_lowest_price = Number(issue_lowest_price);
    if (isNaN(issue_lowest_price)) issue_lowest_price = 0;

    issue_highest_price = Number(issue_highest_price);
    if (isNaN(issue_highest_price)) issue_highest_price = 0;

    if (issue_lowest_price > issue_highest_price) {
      return res.status(400).json({ error: "Lowest price cannot exceed highest price" });
    }

    if (issue_lowest_price < 0 || issue_highest_price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }

    // =========================
    // ✅ NUMBERS
    // =========================

    issue_size = Number(issue_size);
    if (isNaN(issue_size)) issue_size = 0;

    gmp = gmp || "0";

    if (issue_size < 0) {
      return res.status(400).json({ error: "Numeric values must be positive" });
    }

    current_price = Number(current_price);
    if (isNaN(current_price)) current_price = 0;

    ipo_pe_ratio = Number(ipo_pe_ratio);
    if (isNaN(ipo_pe_ratio)) ipo_pe_ratio = 0;

    listing_day_close_bse = Number(listing_day_close_bse);
    if (isNaN(listing_day_close_bse)) listing_day_close_bse = 0;

    listing_day_close_nse = Number(listing_day_close_nse);
    if (isNaN(listing_day_close_nse)) listing_day_close_nse = 0;

    listing_day_open_bse = Number(listing_day_open_bse);
    if (isNaN(listing_day_open_bse)) listing_day_open_bse = 0;

    listing_day_open_nse = Number(listing_day_open_nse);
    if (isNaN(listing_day_open_nse)) listing_day_open_nse = 0;

    // Sanitize sector_ids and sector_id
    const clean_sector_id = (sector_id && Number(sector_id) !== 0) ? Number(sector_id) : null;
    let clean_sector_ids = [];
    if (sector_ids && Array.isArray(sector_ids)) {
      clean_sector_ids = sector_ids
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id !== 0);
    } else if (clean_sector_id) {
      clean_sector_ids = [clean_sector_id];
    }
    const primary_sector_id = (clean_sector_ids.length > 0) ? clean_sector_ids[0] : clean_sector_id;

    if (!primary_sector_id) {
      return res.status(400).json({ error: "Sector is required" });
    }

    let listing_day_gain_percentage_parsed = (listing_day_gain_percentage !== undefined && listing_day_gain_percentage !== null && listing_day_gain_percentage !== '') ? String(listing_day_gain_percentage).trim() : null;
    let listing_price_parsed = (listing_price !== undefined && listing_price !== null && listing_price !== '') ? String(listing_price).trim() : null;

    const fields = [
      'logo', 'issuer_company', 'date_declared', 'open_date', 'close_date',
      'listing_date', 'merchant_bankers', 'issue_lowest_price', 'issue_highest_price',
      'issue_size', 'lot_size', 'exchange', 'gmp', 'issue_category', 'sector_id',
      'merchant_banker', 'current_price', 'ipo_pe_ratio', 'listing_day_close_bse',
      'listing_day_close_nse', 'listing_day_open_bse', 'listing_day_open_nse', 'status', 'upcoming', 'confidential',
      'upcoming_ipo_status', 'admin_blog_id', 'listing_day_gain_percentage', 'listing_price'
    ];

    const values = [
      logo || null,
      issuer_company || '',
      (date_declared === "Yes" || date_declared === "1" || date_declared === 1) ? '1' : '0',
      open_date || null,
      close_date || null,
      listing_date || null,
      merchant_bankers || null,
      issue_lowest_price || 0,
      issue_highest_price || 0,
      issue_size || 0,
      lot_size || 0,
      exchange || '',
      gmp || 0,
      issue_category || '',
      primary_sector_id,
      merchant_banker || null,
      current_price || 0,
      ipo_pe_ratio || null,
      listing_day_close_bse || 0,
      listing_day_close_nse || 0,
      listing_day_open_bse || 0,
      listing_day_open_nse || 0,
      status || 'Active',
      upcoming || '0',
      confidential || '0',
      upcoming_ipo_status || null,
      admin_blog_id || null,
      listing_day_gain_percentage_parsed,
      listing_price_parsed
    ];

    const placeholders = fields.map(() => "?").join(", ");
    const query = `INSERT INTO ipo_lists (${fields.join(", ")}) VALUES (${placeholders})`;

    const [result] = await pool.query(query, values);
    const ipo_id = result.insertId;

    // Save multiple sectors
    if (clean_sector_ids && Array.isArray(clean_sector_ids)) {
      const linkValues = clean_sector_ids.map(sid => [ipo_id, sid]);
      if (linkValues.length > 0) {
        await pool.query("INSERT INTO ipo_sector_links (ipo_id, sector_id) VALUES ?", [linkValues]);
      }
    }

    res.status(201).json({
      success: true,
      id: ipo_id,
      message: "IPO created successfully"
    });

  } catch (error) {
    console.error("Error creating IPO:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

// PUT update existing IPO
router.put("/:id", async (req, res) => {
  try {
    let {
      logo, issuer_company, date_declared, open_date, close_date,
      listing_date, merchant_bankers, issue_lowest_price, issue_highest_price,
      issue_size, lot_size, exchange, gmp, issue_category, sector_id,
      merchant_banker, current_price, ipo_pe_ratio, listing_day_close_bse,
      listing_day_close_nse, listing_day_open_bse, listing_day_open_nse, status, upcoming, confidential,
      upcoming_ipo_status, admin_blog_id, sector_ids, listing_day_gain_percentage, listing_price
    } = req.body;

    // Resolve merchant_bankers names from merchant_banker IDs
    if (merchant_banker) {
      const idArray = String(merchant_banker).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (idArray.length > 0) {
        const [bankersRows] = await pool.query(`SELECT title FROM marchantbankers WHERE id IN (${idArray.join(',')})`);
        merchant_bankers = bankersRows.map(r => r.title).join(', ');
      } else {
        merchant_bankers = null;
      }
    } else {
      merchant_bankers = null;
    }

    const ipo_id = req.params.id;

    // Sanitize sector_ids and sector_id
    const clean_sector_id = (sector_id && Number(sector_id) !== 0) ? Number(sector_id) : null;
    let clean_sector_ids = [];
    if (sector_ids && Array.isArray(sector_ids)) {
      clean_sector_ids = sector_ids
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id !== 0);
    } else if (clean_sector_id) {
      clean_sector_ids = [clean_sector_id];
    }
    const primary_sector_id = (clean_sector_ids.length > 0) ? clean_sector_ids[0] : clean_sector_id;

    if (!primary_sector_id) {
      return res.status(400).json({ error: "Sector is required" });
    }

    // =========================
    // ✅ REQUIRED VALIDATION
    // =========================

    if (!issuer_company || issuer_company.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }

    if (!exchange || exchange.trim() === "") {
      return res.status(400).json({ error: "Exchange is required" });
    }

    if (!issue_category) {
      return res.status(400).json({ error: "Issue category required" });
    }

    // =========================
    // ✅ DATE LOGIC & VALIDATION
    // =========================

    if (date_declared === "Yes" || date_declared === "1" || date_declared === 1) {
      if (!open_date || isNaN(Date.parse(open_date))) {
        return res.status(400).json({ error: "Valid open date required when date is declared" });
      }

      if (!close_date || isNaN(Date.parse(close_date))) {
        return res.status(400).json({ error: "Valid close date required when date is declared" });
      }

      if (new Date(close_date) < new Date(open_date)) {
        return res.status(400).json({
          error: "Close date must be after open date"
        });
      }

      if (listing_date && new Date(listing_date) < new Date(close_date)) {
        return res.status(400).json({
          error: "Listing date must be after close date"
        });
      }
    } else {
      // Clear dates if not declared
      open_date = null;
      close_date = null;
      listing_date = null;
    }

    // =========================
    // ✅ LOT SIZE
    // =========================

    lot_size = Number(lot_size);
    if (isNaN(lot_size) || lot_size < 0) {
      lot_size = 0;
    }

    // =========================
    // ✅ PRICE VALIDATION
    // =========================

    issue_lowest_price = Number(issue_lowest_price);
    if (isNaN(issue_lowest_price)) issue_lowest_price = 0;

    issue_highest_price = Number(issue_highest_price);
    if (isNaN(issue_highest_price)) issue_highest_price = 0;

    if (issue_lowest_price > issue_highest_price) {
      return res.status(400).json({
        error: "Lowest price cannot exceed highest price"
      });
    }

    if (issue_lowest_price < 0 || issue_highest_price < 0) {
      return res.status(400).json({
        error: "Price cannot be negative"
      });
    }

    // =========================
    // ✅ NUMBERS
    // =========================

    issue_size = Number(issue_size);
    if (isNaN(issue_size)) issue_size = 0;

    gmp = gmp || "0";

    if (issue_size < 0) {
      return res.status(400).json({
        error: "Numeric values must be positive"
      });
    }

    current_price = Number(current_price);
    if (isNaN(current_price)) current_price = 0;

    ipo_pe_ratio = Number(ipo_pe_ratio);
    if (isNaN(ipo_pe_ratio)) ipo_pe_ratio = 0;

    listing_day_close_bse = Number(listing_day_close_bse);
    if (isNaN(listing_day_close_bse)) listing_day_close_bse = 0;

    listing_day_close_nse = Number(listing_day_close_nse);
    if (isNaN(listing_day_close_nse)) listing_day_close_nse = 0;

    listing_day_open_bse = Number(listing_day_open_bse);
    if (isNaN(listing_day_open_bse)) listing_day_open_bse = 0;

    listing_day_open_nse = Number(listing_day_open_nse);
    if (isNaN(listing_day_open_nse)) listing_day_open_nse = 0;

    // =========================
    // ✅ ENUM VALIDATION
    // =========================

    const allowedStatus = ["Active", "Inactive"];
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const allowedYesNo = ["0", "1"];
    if (upcoming && !allowedYesNo.includes(upcoming)) {
      return res.status(400).json({ error: "Invalid upcoming value" });
    }

    if (confidential && !allowedYesNo.includes(confidential)) {
      return res.status(400).json({ error: "Invalid confidential value" });
    }

    // =========================
    // ✅ LOGO VALIDATION
    // =========================

    if (logo) {
      const isAbsolute = logo.startsWith("http") || logo.startsWith("data:");
      if (isAbsolute) {
        try {
          new URL(logo);
        } catch {
          return res.status(400).json({ error: "Invalid logo URL" });
        }
      }
    }

    // =========================
    // ✅ UPDATE QUERY
    // =========================

    let listing_day_gain_percentage_parsed = (listing_day_gain_percentage !== undefined && listing_day_gain_percentage !== null && listing_day_gain_percentage !== '') ? String(listing_day_gain_percentage).trim() : null;
    let listing_price_parsed = (listing_price !== undefined && listing_price !== null && listing_price !== '') ? String(listing_price).trim() : null;

    const finalData = {
      logo,
      issuer_company,
      date_declared: (date_declared === "Yes" || date_declared === "1" || date_declared === 1) ? '1' : '0',
      open_date: open_date || null,
      close_date: close_date || null,
      listing_date: listing_date || null,
      merchant_bankers: merchant_bankers || null,
      issue_lowest_price,
      issue_highest_price,
      issue_size,
      lot_size,
      exchange,
      gmp,
      issue_category,
      sector_id: primary_sector_id,
      merchant_banker: merchant_banker || null,
      current_price,
      ipo_pe_ratio: ipo_pe_ratio || null,
      listing_day_close_bse: listing_day_close_bse || 0,
      listing_day_close_nse: listing_day_close_nse || 0,
      listing_day_open_bse: listing_day_open_bse || 0,
      listing_day_open_nse: listing_day_open_nse || 0,
      status: status || "Active",
      upcoming: upcoming || "0",
      confidential: confidential || "0",
      upcoming_ipo_status: upcoming_ipo_status || null,
      admin_blog_id: admin_blog_id || null,
      listing_day_gain_percentage: listing_day_gain_percentage_parsed,
      listing_price: listing_price_parsed
    };

    const fieldsToUpdate = Object.keys(finalData);
    const updates = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
    const updateValues = Object.values(finalData);
    updateValues.push(ipo_id);

    const query = `UPDATE ipo_lists SET ${updates} WHERE id = ?`;

    const [result] = await pool.query(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "IPO not found" });
    }

    // Update multiple sectors
    if (clean_sector_ids && Array.isArray(clean_sector_ids)) {
      await pool.query("DELETE FROM ipo_sector_links WHERE ipo_id = ?", [ipo_id]);
      const linkValues = clean_sector_ids.map(sid => [ipo_id, sid]);
      if (linkValues.length > 0) {
        await pool.query("INSERT INTO ipo_sector_links (ipo_id, sector_id) VALUES ?", [linkValues]);
      }
    }

    res.json({
      success: true,
      message: "IPO updated successfully"
    });

  } catch (error) {
    console.error("Error updating IPO:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

// DELETE IPO
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM ipo_lists WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "IPO not found" });
    }
    res.json({ message: "IPO deleted successfully" });
  } catch (error) {
    console.error("Error deleting IPO:", error);
    res.status(500).json({ error: "Failed to delete IPO" });
  }
});

export default router;
