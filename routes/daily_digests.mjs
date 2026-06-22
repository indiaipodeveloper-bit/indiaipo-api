import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

// Get all daily digests with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(
            `SELECT d.*, COALESCE(NULLIF(b.new_slug, ""), b.slug) as linked_blog_slug 
             FROM daily_digests d 
             LEFT JOIN admin_blogs b ON d.reporter_blog = b.id 
             ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM daily_digests');
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
        console.error("Error fetching daily digests:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// =========================
// Named routes must come BEFORE dynamic :id routes
// =========================

// Get Audience Preview
router.get('/audience', async (req, res) => {

    try {

        const [audience] = await pool.query(
            `
            SELECT DISTINCT LOWER(TRIM(email)) AS email
            FROM
            (
                SELECT email
                FROM visitors
                WHERE is_subscribed = '1'
                AND email IS NOT NULL
                AND TRIM(email) != ''

                UNION

                SELECT email
                FROM check_ipo_eligibility
                WHERE is_subscribed = '1'
                AND email IS NOT NULL
                AND TRIM(email) != ''

            ) AS combined_emails
            `
        );

        return res.status(200).json({
            success: true,
            total: audience.length,
            data: audience
        });

    } catch (err) {

        console.error('❌ Audience Fetch Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });

    }

});

// Get Campaign Stats
router.get('/stats', async (req, res) => {
    try {
        const { digest_id } = req.query;

        let total = 0;
        let processed = 0;
        let failed = 0;
        let pending = 0;
        let audience = 0;

        // Fetch overall subscribed audience count if digest_id is provided
        if (digest_id) {
            const [audienceRows] = await pool.query(
                `
                SELECT COUNT(DISTINCT LOWER(TRIM(email))) as count
                FROM
                (
                    SELECT email
                    FROM visitors
                    WHERE is_subscribed = '1'
                    AND email IS NOT NULL
                    AND TRIM(email) != ''

                    UNION

                    SELECT email
                    FROM check_ipo_eligibility
                    WHERE is_subscribed = '1'
                    AND email IS NOT NULL
                    AND TRIM(email) != ''
                ) AS combined_emails
                `
            );
            audience = audienceRows[0].count;
        }

        // Pending Jobs
        const [pendingRows] = await pool.query(
            `
            SELECT COUNT(*) as count
            FROM jobs
            WHERE queue = 'daily-digest-emails'
            ${digest_id ? 'AND payload LIKE ?' : ''}
            `,
            digest_id ? [`%"digest_id":${digest_id}%`] : []
        );

        pending = pendingRows[0].count;

        // Processed Jobs
        const [processedRows] = await pool.query(
            `
            SELECT COUNT(*) as count
            FROM processed_jobs
            WHERE queue = 'daily-digest-emails'
            ${digest_id ? 'AND digest_id = ?' : ''}
            `,
            digest_id ? [digest_id] : []
        );

        processed = processedRows[0].count;

        // Failed Jobs
        const [failedRows] = await pool.query(
            `
            SELECT COUNT(*) as count
            FROM failed_jobs
            WHERE queue = 'daily-digest-emails'
            ${digest_id ? 'AND digest_id = ?' : ''}
            `,
            digest_id ? [digest_id] : []
        );

        failed = failedRows[0].count;

        total = pending + processed + failed;
        if (total === 0 && digest_id) {
            total = audience;
        }

        res.json({
            total,
            processed,
            failed,
            pending
        });

    } catch (err) {
        console.error('❌ Stats Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Failed Jobs
router.get('/failed-jobs', async (req, res) => {
    try {
        const { digest_id } = req.query;

        if (!digest_id) {
            return res.status(400).json({ error: 'Digest ID is required' });
        }

        const [rows] = await pool.query(
            `
            SELECT id, user_email, exception, failed_at
            FROM failed_jobs
            WHERE queue = 'daily-digest-emails'
            AND digest_id = ?
            ORDER BY failed_at DESC
            `,
            [digest_id]
        );

        res.json(rows);

    } catch (err) {
        console.error('❌ Failed Jobs Fetch Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========================
// 9.2 Get Processed Jobs for a Digest
// =========================
router.get('/processed-jobs', async (req, res) => {
    try {
        const { digest_id } = req.query;

        if (!digest_id) {
            return res.status(400).json({ error: 'Digest ID is required' });
        }

        const [rows] = await pool.query(
            `
            SELECT id, user_email, processed_at
            FROM processed_jobs
            WHERE queue = 'daily-digest-emails'
            AND digest_id = ?
            ORDER BY processed_at DESC
            `,
            [digest_id]
        );

        res.json(rows);

    } catch (err) {
        console.error('❌ Processed Jobs Fetch Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========================
// 9.3 Get Pending Jobs for a Digest
// =========================
router.get('/pending-jobs', async (req, res) => {
    try {
        const { digest_id } = req.query;

        if (!digest_id) {
            return res.status(400).json({ error: 'Digest ID is required' });
        }

        const [rows] = await pool.query(
            `
            SELECT id, payload, attempts, created_at
            FROM jobs
            WHERE queue = 'daily-digest-emails'
            AND payload LIKE ?
            AND attempts = 0
            ORDER BY id ASC
            `,
            [`%"digest_id":${digest_id}%`]
        );

        // Parse payload to get email
        const formatted = rows.map(r => {
            try {
                const p = JSON.parse(r.payload);
                return {
                    id: r.id,
                    user_email: p.email,
                    created_at: r.created_at
                };
            } catch (e) { return null; }
        }).filter(Boolean);

        res.json(formatted);

    } catch (err) {
        console.error('❌ Pending Jobs Fetch Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get a single daily digest
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM daily_digests WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Daily digest not found" });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching daily digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Create daily digest
router.post('/', async (req, res) => {
    try {
        const { title, image, pdf, reporter_blog } = req.body;

        // 1. Create Daily Digest
        const [result] = await pool.query(
            `INSERT INTO daily_digests 
            (title, image, pdf, reporter_blog, created_at, updated_at) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [title, image, pdf, reporter_blog]
        );

        const digestId = result.insertId;



        res.status(201).json({
            success: true,
            digest_id: digestId,
            message: "Daily digest created successfully"
        });

    } catch (err) {
        console.error("Error creating daily digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Update daily digest
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, image, pdf, reporter_blog } = req.body;

        // Build dynamic query
        let query = 'UPDATE daily_digests SET updated_at = CURRENT_TIMESTAMP';
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
        if (reporter_blog !== undefined) {
            query += ', reporter_blog = ?';
            params.push(reporter_blog);
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Daily digest not found" });
        }

        res.json({ message: "Daily digest updated successfully" });
    } catch (err) {
        console.error("Error updating daily digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Delete daily digest
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM daily_digests WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Daily digest not found" });
        }

        res.json({ message: "Daily digest deleted successfully" });
    } catch (err) {
        console.error("Error deleting daily digest:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/send/:id', async (req, res) => {

    let connection;

    try {

        const { id } = req.params;

        connection = await pool.getConnection();

        // ============================================================
        // STEP 1: MySQL distributed lock — ek saath 2 requests block
        // ============================================================
        const lockName = `send_digest_${id}`;
        const [lockResult] = await connection.query('SELECT GET_LOCK(?, 0) as acquired', [lockName]);

        if (!lockResult[0].acquired) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Emails for this digest are already being queued. Please wait.'
            });
        }

        // ============================================================
        // STEP 2: Digest fetch karo
        // ============================================================
        const [digestRows] = await connection.query(
            `SELECT * FROM daily_digests WHERE id = ?`,
            [id]
        );

        if (digestRows.length === 0) {
            await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
            connection.release();
            return res.status(404).json({ success: false, message: 'Daily digest not found' });
        }

        const digest = digestRows[0];

        // ============================================================
        // STEP 3: Check — kya is digest ke KOI BHI jobs queue mein hain?
        //   attempts=0 (pending) OR attempts=1 (reserved/being processed)
        //   DONO cases mein dobara queue mat karo — yahi duplicate ka reason tha
        // ============================================================
        const [pendingCheck] = await connection.query(
            `SELECT COUNT(*) as cnt FROM jobs 
             WHERE queue = 'daily-digest-emails' 
             AND (payload LIKE ? OR payload LIKE ?)`,
            [`%"digest_id":${digest.id},%`, `%"digest_id":${digest.id}}%`]
        );

        if (pendingCheck[0].cnt > 0) {
            await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
            connection.release();
            return res.status(400).json({
                success: false,
                message: `${pendingCheck[0].cnt} emails already in queue (pending/processing). Wait for them to finish first.`
            });
        }

        // ============================================================
        // STEP 4: Audience fetch — processed aur failed ko EXCLUDE karo
        //   UNION ensures no duplicate emails from 2 tables
        //   LOWER(TRIM()) ensures case insensitive deduplication
        // ============================================================
        const [visitors] = await connection.query(
            `
            SELECT DISTINCT LOWER(TRIM(email)) AS email
            FROM (
                SELECT email FROM visitors
                WHERE is_subscribed = '1' AND email IS NOT NULL AND TRIM(email) != ''

                UNION

                SELECT email FROM check_ipo_eligibility
                WHERE is_subscribed = '1' AND email IS NOT NULL AND TRIM(email) != ''
            ) AS combined_audience
            WHERE LOWER(TRIM(email)) NOT IN (
                SELECT LOWER(TRIM(user_email)) 
                FROM processed_jobs 
                WHERE digest_id = ? AND queue = 'daily-digest-emails'
                  AND user_email IS NOT NULL
            )
            AND LOWER(TRIM(email)) NOT IN (
                SELECT LOWER(TRIM(user_email)) 
                FROM failed_jobs 
                WHERE digest_id = ? AND queue = 'daily-digest-emails'
                  AND user_email IS NOT NULL
            )
            `,
            [id, id]
        );

        console.log(`📋 Total eligible audience for digest ${id}:`, visitors.length);

        if (visitors.length === 0) {
            await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
            connection.release();
            return res.status(200).json({
                success: true,
                message: 'All subscribers have already received this digest. No new emails to queue.'
            });
        }

        // ============================================================
        // STEP 5: Bulk INSERT — ek saath saare jobs insert karo
        //   Har email ke liye ek row — attempts=0, reserved_at=NULL
        // ============================================================
        const now = Math.floor(Date.now() / 1000);
        let insertedCount = 0;

        for (const visitor of visitors) {
            const email = visitor.email.trim().toLowerCase();
            if (!email) continue;

            const payload = JSON.stringify({
                job_name: 'SendDailyDigestEmail',
                email: email,
                digest_id: digest.id,
                title: digest.title,
                pdf: digest.pdf,
                image: digest.image
            });

            await connection.query(
                `INSERT INTO jobs (queue, payload, attempts, reserved_at, available_at, created_at)
                 VALUES (?, ?, 0, NULL, ?, ?)`,
                ['daily-digest-emails', payload, now, now]
            );

            insertedCount++;
        }

        console.log(`✅ Queued ${insertedCount} emails for digest ${id}`);

        // ============================================================
        // STEP 6: Lock release aur response
        // ============================================================
        await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
        connection.release();

        return res.status(200).json({
            success: true,
            digest_id: digest.id,
            total_queued: insertedCount,
            message: `${insertedCount} emails queued successfully`
        });

    } catch (err) {

        console.error('❌ Send Digest Error:', err);

        if (connection) {
            try {
                const { id } = req.params;
                await connection.query('SELECT RELEASE_LOCK(?)', [`send_digest_${id}`]);
                connection.release();
            } catch (_) {}
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });

    }
});




// =========================
// 8. Retry Failed Emails
// =========================
router.post('/retry-failed', async (req, res) => {
    try {
        const { digest_id } = req.body;

        // Fetch failed jobs
        const [failedJobs] = await pool.query(
            `
            SELECT *
            FROM failed_jobs
            WHERE queue = 'daily-digest-emails'
            ${digest_id ? 'AND digest_id = ?' : ''}
            `,
            digest_id ? [digest_id] : []
        );

        if (failedJobs.length === 0) {
            return res.json({ success: true, message: 'No failed jobs to retry' });
        }

        const now = Math.floor(Date.now() / 1000);

        for (const job of failedJobs) {
            // Re-insert into jobs table
            await pool.query(
                `
                INSERT INTO jobs
                (
                    queue,
                    payload,
                    attempts,
                    reserved_at,
                    available_at,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    'daily-digest-emails',
                    job.payload,
                    0,
                    null,
                    now,
                    now
                ]
            );

            // Delete from failed_jobs
            await pool.query('DELETE FROM failed_jobs WHERE id = ?', [job.id]);
        }

        res.json({
            success: true,
            message: `${failedJobs.length} jobs re-queued successfully`
        });

    } catch (err) {
        console.error('❌ Retry Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// =========================
// 10. Retry a Specific Job
// =========================
router.post('/retry-job/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch failed job
        const [rows] = await pool.query(
            'SELECT * FROM failed_jobs WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Failed job not found' });
        }

        const job = rows[0];
        const now = Math.floor(Date.now() / 1000);

        // Re-insert into jobs
        await pool.query(
            `
            INSERT INTO jobs
            (
                queue,
                payload,
                attempts,
                reserved_at,
                available_at,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                'daily-digest-emails',
                job.payload,
                0,
                null,
                now,
                now
            ]
        );

        // Delete from failed_jobs
        await pool.query('DELETE FROM failed_jobs WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Job re-queued successfully'
        });

    } catch (err) {
        console.error('❌ Individual Retry Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;

