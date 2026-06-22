import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.join(__dirname, '../', envFile) });

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "email-smtp.ap-south-1.amazonaws.com",
    port: Number(process.env.MAIL_PORT || 587),
    secure: Number(process.env.MAIL_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.SES_SMTP_USER || process.env.GMAIL,
        pass: process.env.SES_SMTP_PASS || process.env.GMAIL_PASS,
    }
});


router.post('/', verifyRecaptcha('annual_report_form'), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Save to database with count increment
        await pool.execute(
            `INSERT INTO annual_report_requests (email, request_count) 
             VALUES (?, 1) 
             ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
            [email]
        );

        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const downloadUrl = `${siteUrl}/Annual_Report.pdf`;

        // Simple, Clean, Professional White Theme
        const bgWhite = '#ffffff';
        const textMain = '#1a202c';
        const textSecondary = '#4a5568';
        const brandBlue = '#2b6cb0';

        // Send email
        const mailOptions = {
            from: `"India IPO" <${process.env.MAIL_FROM_ADDRESS || process.env.SES_SMTP_USER}>`,
            to: email,
            subject: 'Your FY2026 IPO Annual Report is Ready',
            html: `
                <div style="background-color: #f7fafc; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: ${bgWhite}; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                        
                        <!-- Minimal Header -->
                        <div style="padding: 40px 40px 20px 40px; text-align: left;">
                            <div style="color: ${brandBlue}; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 30px;">
                                INDIA IPO
                            </div>
                            
                            <h1 style="color: ${textMain}; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">
                                FY2026 Strategic <br>Annual Report
                            </h1>
                        </div>

                        <!-- Content -->
                        <div style="padding: 0 40px 40px 40px;">
                            <p style="color: ${textSecondary}; font-size: 16px; line-height: 1.6; margin: 25px 0;">
                                Hello, <br><br>
                                Get a deep-dive analysis of India’s evolving IPO market, sector-wise performance trends, and the FY27 pipeline driving the next wave of listings.
                            </p>

                            <div style="margin: 40px 0;">
                                <a href="${downloadUrl}" style="display: inline-block; background-color: ${brandBlue}; color: #ffffff !important; text-decoration: none; padding: 16px 35px; border-radius: 8px; font-weight: 700; font-size: 16px; transition: background 0.3s ease;">
                                    Download Full Report (PDF)
                                </a>
                            </div>

                            <p style="color: #a0aec0; font-size: 13px; font-style: italic; border-top: 1px solid #edf2f7; padding-top: 25px; margin-top: 40px;">
                                This report is intended for informational purposes. India IPO is committed to providing data-driven market intelligence for informed decision-making.
                            </p>
                        </div>

                        <!-- Simple Footer -->
                        <div style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #edf2f7;">
                            <p style="color: #718096; font-size: 12px; margin: 0;">
                                © 2025 India IPO. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: 'Request received and email sent successfully' });
    } catch (err) {
        console.error('Error handling annual report request:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all requests (for admin)
// GET /api/annual-report-requests
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM annual_report_requests ORDER BY updated_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching annual report requests:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
