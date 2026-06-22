/**
 * reCAPTCHA v3 Backend Middleware
 *
 * Usage in any route file:
 *   import { verifyRecaptcha } from '../middleware/recaptcha.mjs';
 *   router.post('/submit', verifyRecaptcha('contact_form'), handler);
 *
 * Frontend se 'recaptchaToken' field body mein bhejo.
 * Score < 0.5 hone par automatically 403 return karta hai.
 */

import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env (Priority: server folder then root folder)
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });
dotenv.config({ path: path.join(__dirname, '..', '.env.development') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SECRET_KEY = process.env.RECAPTCHAV3_SECRET_KEY;
const SCORE_THRESHOLD = 0.5;

export function verifyRecaptcha(expectedAction = null) {
  return async (req, res, next) => {
    const currentSecret = (process.env.RECAPTCHAV3_SECRET_KEY || SECRET_KEY || '').trim();
    const token = req.body?.recaptchaToken;

    console.log('📦 Request Path:', req.originalUrl);
    console.log('📦 Token Present:', !!token);

    if (!currentSecret) {
      console.log('❌ CRITICAL: RECAPTCHAV3_SECRET_KEY is missing');
      return next();
    }

    if (!token) {
      console.log('⚠️  No recaptchaToken found in request body');
      return res.status(400).json({ error: 'reCAPTCHA token missing.' });
    }

    const postData = `secret=${currentSecret}&response=${token}`;

    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Google API Response:', result);

          if (!result.success) {
            console.error('❌ reCAPTCHA Failed:', result['error-codes']);
            return res.status(403).json({ error: 'reCAPTCHA failed.', codes: result['error-codes'] });
          }

          if (result.score < SCORE_THRESHOLD) {
            console.warn(`🚫 Low score: ${result.score}`);
            return res.status(403).json({ error: 'Suspicious activity.' });
          }

          req.recaptcha = result;
          next();
        } catch (e) {
          console.error('❌ Parse Error:', e.message);
          next();
        }
      });
    });

    request.on('error', (err) => {
      console.error('❌ HTTPS Request Error:', err.message);
      next();
    });

    request.write(postData);
    request.end();
  };
}
