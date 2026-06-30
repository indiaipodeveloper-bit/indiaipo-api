import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).send(`
        <h2>Email missing</h2>
      `);
        }

        await pool.query(
            `
      UPDATE visitors
      SET is_subscribed = 0
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
      `,
            [email]
        );

        const siteUrl = `https://www.indiaipo.in`;

        return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribed Successfully</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #f3f6fb;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  color: #1e293b;
              }
              .card {
                  background: white;
                  padding: 50px 40px;
                  border-radius: 24px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.06);
                  text-align: center;
                  max-width: 450px;
                  width: 90%;
              }
              .icon-circle {
                  width: 80px;
                  height: 80px;
                  background: #ecfdf5;
                  border-radius: 50%;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin: 0 auto 25px;
                  color: #10b981;
                  font-size: 40px;
              }
              h1 {
                  font-size: 28px;
                  margin: 0 0 12px;
                  font-weight: 800;
                  color: #0f172a;
              }
              p {
                  font-size: 16px;
                  color: #64748b;
                  line-height: 1.6;
                  margin-bottom: 30px;
              }
              .btn {
                  display: inline-block;
                  background: #2563eb;
                  color: white;
                  text-decoration: none;
                  padding: 14px 32px;
                  border-radius: 12px;
                  font-weight: 700;
                  font-size: 16px;
                  transition: all 0.2s;
                  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
              }
              .btn:hover {
                  background: #1d4ed8;
                  transform: translateY(-2px);
                  box-shadow: 0 6px 15px rgba(37, 99, 235, 0.3);
              }
              .redirect-text {
                  margin-top: 25px;
                  font-size: 14px;
                  color: #94a3b8;
              }
              #countdown {
                  font-weight: bold;
                  color: #64748b;
              }
          </style>
          <script>
              let seconds = 5;
              const siteUrl = "${siteUrl}";
              
              function countdown() {
                  seconds--;
                  document.getElementById('countdown').textContent = seconds;
                  if (seconds <= 0) {
                      window.location.href = siteUrl;
                  } else {
                      setTimeout(countdown, 1000);
                  }
              }
              window.onload = function() {
                  setTimeout(countdown, 1000);
              };
          </script>
      </head>
      <body>
          <div class="card">
              <div class="icon-circle">✓</div>
              <h1>Success!</h1>
              <p>You have been unsubscribed. You will no longer receive our Daily Digest emails.</p>
              
              <a href="${siteUrl}" class="btn">Go to Website</a>
              
              <div class="redirect-text">
                  Redirecting to website in <span id="countdown">5</span> seconds...
              </div>
          </div>
      </body>
      </html>
    `);

    } catch (error) {
        console.error(error);

        return res.status(500).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Something went wrong</h2>
        <p>Please try again later or contact support.</p>
      </div>
    `);
    }
});

export default router;