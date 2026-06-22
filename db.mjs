import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment file selection
const envFile =
    process.env.NODE_ENV === 'production'
        ? '.env.production'
        : '.env.development';

// Possible env locations
const envPaths = [
    path.join(__dirname, envFile),
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env')
];

// Load first existing env file only
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`✅ Loaded ENV from: ${envPath}`);
        break;
    }
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'newipo_db',
    port: parseInt(process.env.MYSQL_PORT || '3306'),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // Prevent MySQL date conversion issues
    dateStrings: true,

    // Better production stability
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

pool.getConnection()
    .then(connection => {
        console.log('✅ Connected to MySQL successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Failed:', err.message);
    });

export default pool;