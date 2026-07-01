import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import pool from '../db.mjs';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET all migrations with pagination, search, and exchange filter
router.get('/', async (req, res) => {
    try {
        const exchange = req.query.exchange || 'NSE';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        const targetExchange = exchange.toUpperCase();

        let query = 'SELECT * FROM sme_migrations WHERE exchange_type = ?';
        let countQuery = 'SELECT COUNT(*) as count FROM sme_migrations WHERE exchange_type = ?';
        let queryParams = [targetExchange];
        let countParams = [targetExchange];

        if (search) {
            query += ' AND (company_name LIKE ? OR merchant_banker LIKE ? OR exchanges LIKE ?)';
            countQuery += ' AND (company_name LIKE ? OR merchant_banker LIKE ? OR exchanges LIKE ?)';
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
        queryParams.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(query, queryParams);
        const [totalRows] = await pool.execute(countQuery, countParams);
        const total = totalRows[0].count;

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
        res.status(500).json({ error: err.message });
    }
});

// DELETE all migrations of a specific exchange
router.delete('/', async (req, res) => {
    try {
        const { exchange } = req.query;
        if (!exchange || !['NSE', 'BSE'].includes(exchange.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid or missing exchange query parameter' });
        }
        await pool.execute('DELETE FROM sme_migrations WHERE exchange_type = ?', [exchange.toUpperCase()]);
        res.json({ message: `Successfully deleted all SME ${exchange.toUpperCase()} migrations` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function formatDateObject(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatExcelDate(val) {
    if (!val) return '';
    
    // If it's a JS Date object
    if (val instanceof Date) {
        return formatDateObject(val);
    }
    
    // If it's a string, check if it's a full Date string (contains GMT or India Standard Time)
    const strVal = String(val).trim();
    if (strVal.includes('GMT') || strVal.includes('Standard Time')) {
        const parsedDate = new Date(strVal);
        if (!isNaN(parsedDate.getTime())) {
            return formatDateObject(parsedDate);
        }
    }
    
    return strVal;
}

// POST upload and parse Excel/CSV migration lists
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const exchange = req.body.exchange || 'NSE';
        const targetExchange = exchange.toUpperCase();
        if (!['NSE', 'BSE'].includes(targetExchange)) {
            return res.status(400).json({ error: 'Invalid exchange type. Must be NSE or BSE.' });
        }

        // Parse excel using xlsx library
        const workbook = xlsx.read(req.file.buffer, {
            type: 'buffer',
            cellDates: true,
            raw: false
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Locate header row dynamically
        let headerIndex = -1;
        let headers = [];

        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!Array.isArray(row)) continue;
            
            const normalized = Array.from(row).map(cell => String(cell || '').toLowerCase().trim());
            const hasCompanyName = normalized.some(val => val && (val.includes('company name') || val.includes('companyname')));
            const hasMigrationDate = normalized.some(val => val && (val.includes('migration date') || val.includes('migrationdate')));
            
            if (hasCompanyName && hasMigrationDate) {
                headerIndex = i;
                headers = normalized;
                break;
            }
        }

        if (headerIndex === -1) {
            return res.status(400).json({ error: 'Could not find header row with "Company name" and "Migration date"' });
        }

        const dataRows = rawData.slice(headerIndex + 1);
        const parsedRecords = [];

        for (const row of dataRows) {
            if (!Array.isArray(row) || row.length === 0) continue;
            
            const getVal = (keywords) => {
                const idx = headers.findIndex(h => h && keywords.some(k => h.includes(k)));
                if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
                    return formatExcelDate(row[idx]);
                }
                return '';
            };
            
            const companyName = getVal(['company name', 'companyname']);
            if (!companyName) continue; // Skip rows that don't have a company name
            
            parsedRecords.push({
                sno: getVal(['sno', 's.no', 's. no', 'sr.no', 'sr. no']),
                company_name: companyName,
                ipo_date: getVal(['ipo date', 'ipodate']),
                exchanges: getVal(['exchanges', 'exchange']),
                merchant_banker: getVal(['merchant banker', 'merchantbanker']),
                ipo_size: getVal(['ipo size', 'size', 'cr']),
                migration_date: getVal(['migration date', 'migrationdate']),
                issue_price: getVal(['issue price', 'issueprice', 'price'])
            });
        }

        if (parsedRecords.length === 0) {
            return res.status(400).json({ error: 'No valid data rows found in the spreadsheet.' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Clear previous migration lists for this exchange type
            await conn.execute('DELETE FROM sme_migrations WHERE exchange_type = ?', [targetExchange]);

            // Bulk insert new rows
            const insertQuery = `
                INSERT INTO sme_migrations (
                    exchange_type, sno, company_name, ipo_date, exchanges, merchant_banker, ipo_size, migration_date, issue_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const r of parsedRecords) {
                await conn.execute(insertQuery, [
                    targetExchange,
                    r.sno,
                    r.company_name,
                    r.ipo_date,
                    r.exchanges,
                    r.merchant_banker,
                    r.ipo_size,
                    r.migration_date,
                    r.issue_price
                ]);
            }

            await conn.commit();
            res.json({
                success: true,
                message: `Successfully uploaded and imported ${parsedRecords.length} companies to SME ${targetExchange} Migration List.`
            });
        } catch (dbErr) {
            await conn.rollback();
            throw dbErr;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('Migration list import error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
