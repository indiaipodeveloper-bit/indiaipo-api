import express from 'express';
import pool from '../db.mjs';
import { verifyRecaptcha } from '../middleware/recaptcha.mjs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const emailSchema = z.string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string"
})
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" });

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

// Add a new subscriber
// POST /api/subscriptions
router.post('/', verifyRecaptcha('newsletter_subscribe'), async (req, res) => {
    try {
        const { email } = req.body;

        const validation = emailSchema.safeParse(email);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors[0].message });
        }

        const validatedEmail = validation.data;

        // Check for existing subscription first in visitors table
        const [existing] = await pool.query("SELECT * FROM visitors WHERE email = ? AND form_type = 'subscription'", [validatedEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email is already subscribed' });
        }

        const [result] = await pool.query(
            "INSERT INTO visitors (form_type, email, is_subscribed) VALUES ('subscription', ?, 1)",
            [validatedEmail]
        );

        // Send email
        const bgWhite = '#ffffff';
        const textMain = '#1a202c';
        const textSecondary = '#4a5568';
        const brandBlue = '#2b6cb0';

        const mailOptions = {
            from: `"India IPO" <${process.env.MAIL_FROM_ADDRESS || process.env.GMAIL}>`,
            to: validatedEmail,
            subject: 'Welcome to India IPO Daily Reports!',
            html: `
                <div style="background-color: #f7fafc; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: ${bgWhite}; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                        
                        <!-- Minimal Header -->
                        <div style="padding: 40px 40px 20px 40px; text-align: left;">
                            <div style="color: ${brandBlue}; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 30px;">
                                INDIA IPO
                            </div>
                            
                            <h1 style="color: ${textMain}; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3;">
                                Thank You for Subscribing!
                            </h1>
                        </div>

                        <!-- Content -->
                        <div style="padding: 0 40px 40px 40px;">
                            <p style="color: ${textSecondary}; font-size: 16px; line-height: 1.6; margin: 25px 0;">
                                Hello, <br><br>
                                Thank you for subscribing to India IPO! We are thrilled to have you on board.
                                <br><br>
                                You will now start receiving our Daily Reports, keeping you updated with live GMP updates, IPO alerts, allotment news, and exclusive market insights directly in your inbox.
                                <br><br>
                                Stay ahead of the IPO market curve with us!
                            </p>

                            <p style="color: #a0aec0; font-size: 13px; font-style: italic; border-top: 1px solid #edf2f7; padding-top: 25px; margin-top: 40px;">
                                India IPO is committed to providing data-driven market intelligence for informed decision-making.
                            </p>
                        </div>

                        <!-- Simple Footer -->
                        <div style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #edf2f7;">
                            <p style="color: #718096; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} India IPO. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.error('Error sending subscription email:', mailErr);
            // We still want to return 201 as the subscription was successful
        }

        res.status(201).json({ id: result.insertId, email: validatedEmail });
    } catch (err) {
        console.error('Error inserting subscription:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all subscriptions
// GET /api/subscriptions
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM visitors WHERE form_type = 'subscription' ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching subscriptions:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update subscription status
// PUT /api/subscriptions/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_subscribed } = req.body;

        await pool.query(
            "UPDATE visitors SET is_subscribed = ? WHERE id = ? AND form_type = 'subscription'",
            [is_subscribed, id]
        );
        res.json({ message: 'Subscription updated successfully' });
    } catch (err) {
        console.error('Error updating subscription:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a subscription
// DELETE /api/subscriptions/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM visitors WHERE id = ? AND form_type = 'subscription'", [id]);
        res.json({ message: 'Subscription deleted successfully' });
    } catch (err) {
        console.error('Error deleting subscription:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
