import express from 'express';
import fetch from 'node-fetch';
import pool from '../db.mjs';

const router = express.Router();

const cache = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// GET all videos sorted by sort_order
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM videos ORDER BY sort_order ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const fallbackToDatabase = async (maxResults, pageToken) => {
    console.log(`[YouTube API] YouTube quota exceeded or failed. Falling back to local database 'social_media'...`);
    
    let page = 1;
    if (pageToken && pageToken.startsWith('page_')) {
        page = parseInt(pageToken.replace('page_', '')) || 1;
    }
    const limit = parseInt(maxResults) || 12;
    const offset = (page - 1) * limit;

    try {
        const [rows] = await pool.query(
            "SELECT * FROM social_media ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        const [[{ total }]] = await pool.query(
            "SELECT COUNT(*) as total FROM social_media"
        );

        const items = rows.map(row => {
            let videoId = row.img_url || '';
            if (row.url) {
                if (row.url.includes('v=')) {
                    videoId = row.url.split('v=')[1].split('&')[0];
                } else if (row.url.includes('youtu.be/')) {
                    videoId = row.url.split('youtu.be/')[1].split('?')[0];
                } else if (row.url.includes('?')) {
                    videoId = row.url.split('?')[0];
                } else {
                    videoId = row.url;
                }
            }

            const highThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
            const defaultThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';

            return {
                id: `db_${row.id}`,
                snippet: {
                    title: row.title,
                    publishedAt: row.created_at || new Date().toISOString(),
                    resourceId: {
                        kind: 'youtube#video',
                        videoId: videoId
                    },
                    thumbnails: {
                        high: { url: highThumbnail },
                        default: { url: defaultThumbnail }
                    }
                }
            };
        });

        const totalPages = Math.ceil(total / limit);
        const nextPageToken = page < totalPages ? `page_${page + 1}` : null;
        const prevPageToken = page > 1 ? `page_${page - 1}` : null;

        const mockResponse = {
            kind: 'youtube#playlistItemListResponse',
            items: items,
            pageInfo: {
                totalResults: total,
                resultsPerPage: limit
            }
        };

        if (nextPageToken) {
            mockResponse.nextPageToken = nextPageToken;
        }
        if (prevPageToken) {
            mockResponse.prevPageToken = prevPageToken;
        }

        return mockResponse;
    } catch (dbErr) {
        console.error('[YouTube API Fallback] Database query failed:', dbErr);
        throw dbErr;
    }
};

router.get('/youtube/playlistItems', async (req, res) => {
    try {
        const { maxResults = 6, pageToken = '' } = req.query;
        const cacheKey = `${maxResults}_${pageToken}`;

        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
            console.log(`[YouTube API] Serving from cache for key: ${cacheKey}`);
            return res.json(cache[cacheKey].data);
        }

        const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
        const playlistId = process.env.VITE_YOUTUBE_PLAYLIST_ID || process.env.YOUTUBE_PLAYLIST_ID;

        if (!apiKey || !playlistId) {
            console.warn('[YouTube API] Credentials not configured. Trying database fallback...');
            try {
                const dbData = await fallbackToDatabase(maxResults, pageToken);
                return res.status(200).json(dbData);
            } catch (fallbackErr) {
                return res.status(500).json({ error: 'YouTube API credentials are not configured and database fallback failed.' });
            }
        }

        let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&key=${apiKey}`;
        if (pageToken && !pageToken.startsWith('page_')) url += `&pageToken=${pageToken}`;

        console.log(`[YouTube API] Fetching fresh data for key: ${cacheKey}`);
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            cache[cacheKey] = { timestamp: Date.now(), data: data };
            res.status(200).json(data);
        } else {
            console.error('[YouTube API] Error fetching from YouTube:', data);
            try {
                const dbData = await fallbackToDatabase(maxResults, pageToken);
                return res.status(200).json(dbData);
            } catch (fallbackErr) {
                res.status(response.status).json(data);
            }
        }
    } catch (err) {
        console.error('[YouTube API] Server error:', err);
        try {
            const dbData = await fallbackToDatabase(req.query.maxResults, req.query.pageToken);
            return res.status(200).json(dbData);
        } catch (fallbackErr) {
            res.status(500).json({ error: err.message });
        }
    }
});

// POST create a new video
router.post('/', async (req, res) => {
    try {
        const { title, youtube_id, description = '', is_active = 1, sort_order = 0 } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO videos (title, youtube_id, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?)',
            [title, youtube_id, description, is_active, sort_order]
        );
        const [rows] = await pool.execute('SELECT * FROM videos WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a video
router.put('/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.execute(`UPDATE videos SET ${fields} WHERE id = ?`, values);
        const [rows] = await pool.execute('SELECT * FROM videos WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a video
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM videos WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Video not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
