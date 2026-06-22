import pool from './db.mjs';
async function fixDb() {
  try {
    await pool.query('ALTER TABLE blog_slug ADD COLUMN title VARCHAR(255) DEFAULT "", ADD COLUMN excerpt TEXT, ADD COLUMN content LONGTEXT, ADD COLUMN category VARCHAR(100) DEFAULT "", ADD COLUMN status VARCHAR(50) DEFAULT "draft", ADD COLUMN image_url VARCHAR(512) DEFAULT "", ADD COLUMN author VARCHAR(255) DEFAULT "Admin", ADD COLUMN tags VARCHAR(500) DEFAULT ""');
    console.log('Altered successfully');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
fixDb();
