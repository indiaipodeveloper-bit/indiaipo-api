import nodemailer from "nodemailer";
import pool from "../db.mjs";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific config (worker is in server/worker/, so files are in ../)
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

const envPaths = [
  path.join(__dirname, "..", envFile),
  path.join(__dirname, "..", ".env"),
];

for (const envPath of envPaths) {
  dotenv.config({
    path: envPath,
    override: false,
  });
}



const BATCH_SIZE = 100;

// Create Transporter
const transporter = nodemailer.createTransport({
  host: "email-smtp.ap-south-1.amazonaws.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  }


});

// Execution Logic
const runOnce = process.argv.includes("--once");

async function startWorker() {
  if (runOnce) {
    console.log("🏃 Running one-time campaign process...");
    // Process in batches until empty
    let jobsLeft = true;
    while (jobsLeft) {
      const count = await processJobs();
      if (count === 0) jobsLeft = false;
    }
    console.log("🏁 Campaign batch finished. Exiting.");
    process.exit(0);
  } else {
    // Continuous mode
    console.log("🔄 Worker started in continuous mode (Interval: 2 mins)");
    setInterval(processJobs, 2 * 60 * 1000);
    processJobs();
  }
}

// Updated processJobs to return count
export async function processJobs() {
  console.log("📨 Checking email jobs...");
  try {
    // Sirf wahi jobs lo jo abhi tak attempt nahi hui (attempts = 0) aur reserved nahi hain
    // Yeh ensure karta hai ki ek job sirf ek hi worker process kare — no duplicate emails
    const [jobs] = await pool.query(
      `SELECT * FROM jobs WHERE queue = 'daily-digest-emails' AND attempts = 0 AND reserved_at IS NULL ORDER BY id ASC LIMIT ?`,
      [BATCH_SIZE],
    );

    if (jobs.length === 0) {
      console.log("✅ No pending jobs");
      return 0;
    }

    console.log(`🚀 Processing ${jobs.length} jobs`);

    for (const job of jobs) {
      let email = null;
      let digest_id = null;
      try {
        // Job ko TURANT reserve karo — attempts=1, reserved_at=NOW()
        // Isse dusra worker yeh job nahi uthayega (double email nahi jayegi)
        const [reserveResult] = await pool.query(
          `UPDATE jobs SET attempts = 1, reserved_at = UNIX_TIMESTAMP() WHERE id = ? AND attempts = 0 AND reserved_at IS NULL`,
          [job.id]
        );

        // Agar 0 rows affected huye matlab kisi aur worker ne pehle hi reserve kar liya — skip karo
        if (reserveResult.affectedRows === 0) {
          console.log(`⏭️  Job ${job.id} already reserved by another worker, skipping...`);
          continue;
        }

        const payload = JSON.parse(job.payload);
        email = payload.email;
        digest_id = payload.digest_id;
        const { title, pdf, image } = payload;
        const unsubscribeUrl = `${process.env.API_URL}/unsubscribe?email=${encodeURIComponent(email)}`;

        await transporter.sendMail({
          from: `"${process.env.APP_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
          to: email,

          subject: `Daily Digest - ${title}`,

          text: `
Your Daily Digest report is ready.

Open PDF:
${pdf.startsWith("http") ? pdf : process.env.API_URL + "/" + pdf}

Unsubscribe:
${unsubscribeUrl}
`,
          html: `
                        <div style="margin:0; padding:40px 15px; background:#f3f6fb; font-family:Arial,sans-serif;">
                            <div style="max-width:700px; margin:auto; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 6px 25px rgba(0,0,0,0.08);">
                                <div style="background:linear-gradient(135deg,#0f172a,#1e293b); padding:35px 25px; text-align:center;">
                                    <h1 style="margin:0; color:white; font-size:34px; font-weight:bold;">Daily Digest</h1>
                                    <p style="margin-top:10px; color:#cbd5e1; font-size:15px;">Latest IPO Updates & Market Insights</p>
                                </div>
                              <div style="padding:40px 20px; text-align:center; background:#f8fafc;">
    <h1 style="margin:0; font-size:42px; font-weight:800; color:#0f172a; letter-spacing:1px;">
        India IPO
    </h1>
</div>
                                <div style="padding:40px 35px;">
                                    <h2 style="margin-top:0; color:#111827; font-size:30px; line-height:1.4;">${title}</h2>
                                    <p style="color:#4b5563; font-size:16px; line-height:1.8; margin-top:20px;">Your latest Daily Digest report is now available. Click below to open the full PDF report.</p>
                                    ${pdf
              ? `
                                    <div style="text-align:center; margin:40px 0;">
                                        <a href="${pdf.startsWith("http") ? pdf : process.env.API_URL + "/" + pdf}" target="_blank" style="background:#2563eb; color:white; text-decoration:none; padding:18px 36px; border-radius:12px; display:inline-block; font-size:17px; font-weight:bold;">📄 Open Full PDF</a>
                                    </div>
                                    `
              : ""
            }
                                    <hr style="border:none; border-top:1px solid #e5e7eb; margin:35px 0;" />
                                    <div style="text-align:center;">
                                        <p style="color:#6b7280; font-size:13px; margin-bottom:15px;">You are receiving this email because you subscribed to Daily Digest updates.</p>
                                        <a href="${unsubscribeUrl}" style="color:#dc2626; text-decoration:none; font-size:13px; font-weight:bold;">Unsubscribe</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `,
        });

        await pool.query(
          `INSERT INTO processed_jobs 
    (connection_name, queue, job_name, digest_id, user_email, processed_at, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
          [
            "database",
            "daily-digest-emails",
            "SendDailyDigestEmail",
            digest_id,
            email,
          ],
        );

        await pool.query(`DELETE FROM jobs WHERE id = ?`, [job.id]);
        console.log(`✅ Sent: ${email}`);
      } catch (err) {
        console.error(`❌ Failed Job ID ${job.id}:`, err.message);

        let fallbackEmail = email;
        let fallbackDigestId = digest_id;
        if (!fallbackEmail || !fallbackDigestId) {
          try {
            const parsed = JSON.parse(job.payload);
            fallbackEmail = fallbackEmail || parsed.email;
            fallbackDigestId = fallbackDigestId || parsed.digest_id;
          } catch (parseErr) { }
        }

        await pool.query(
          `INSERT INTO failed_jobs 
    (uuid, connection, queue, payload, exception, digest_id, user_email, failed_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            crypto.randomUUID(),
            "database",
            "daily-digest-emails",
            job.payload,
            err.message,
            fallbackDigestId || null,
            fallbackEmail || null,
          ],
        );
        await pool.query(`DELETE FROM jobs WHERE id = ?`, [job.id]);
      }
    }
    return jobs.length;
  } catch (err) {
    console.error("❌ Worker Error:", err.message);
    return 0;
  }
}

if (!global.workerStarted) {
  global.workerStarted = true;
  startWorker();
}
