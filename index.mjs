import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pool from './db.mjs';
import helmet from 'helmet';

// Route imports
// import "./cron/newsCron.js";
import { fetchAndSaveNews } from "./cron/newsCron.js";
import videoRoutes from './routes/videos.mjs';
import notificationRoutes from './routes/notifications.mjs';
import reportRoutes from './routes/reports.mjs';
import bankerRoutes from './routes/bankers.mjs';
import bankerSubcategoryRoutes from './routes/banker_subcategories.mjs';
import leadRoutes from './routes/leads.mjs';
import uploadRoutes from './routes/upload.mjs';
import knowledgeRoutes from './routes/knowledge.mjs';
import bannerRoutes from './routes/banners.mjs';
import blogRoutes from './routes/blogs.mjs';
import newsRoutes from './routes/news.mjs';
import investorRoutes from './routes/investor.mjs';
import socialMediaRoutes from './routes/social_media.mjs';
import ipoFeasibilityRoutes from './routes/ipo_feasibility.mjs';
import csrRoutes from './routes/csr.mjs';
import mainboardBankerRoutes from './routes/mainboard_bankers.mjs';
import careerRoutes from './routes/careers.mjs';
import adminBlogsRoutes from './routes/admin_blogs.mjs';
import popupRoutes from './routes/popup.mjs';
import registrarRoutes from './routes/registrars.mjs';
import registrarFaqRoutes from './routes/registrarFaqs.mjs';
import dailyDigestRoutes from './routes/daily_digests.mjs';
import ipoListRoutes from './routes/ipo_lists.mjs';
import sectorRoutes from './routes/sectors.mjs';
import subscriptionRoutes from './routes/subscriptions.mjs';
import consultantRoutes from './routes/consultants.mjs';
import consultantEnquiryRoutes from './routes/consultant_enquiries.mjs';
import dashboardRoutes from './routes/dashboard.mjs';
import seoRoutes from './routes/seo_settings.mjs';
import seoPagesRoutes from './routes/seo_pages.mjs';
import authRoutes from './routes/auth.mjs';
import usersRoutes from './routes/users.mjs';
import bcrypt from 'bcryptjs';
import unsubscribeRoutes from './routes/unsubscribe.mjs';

import magazineRoutes from './routes/magazines.mjs';
import annualReportRequestRoutes from './routes/annual_report_requests.mjs';
import uploadMagazineRoutes
    from './routes/uploadMagazine.mjs';
import uploadDailyReporterRoutes
    from './routes/uploadDailyReporter.mjs';
import uploadWeeklyReporterRoutes
    from './routes/uploadWeeklyReporter.mjs';
import weeklyDigestRoutes from './routes/weekly_digests.mjs';
import smeMigrationRoutes from './routes/sme_migrations.mjs';

// Workers
import { processJobs } from './worker/sendDailyDigestWorker.mjs';
import { authenticateAdmin } from './middleware/auth.mjs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific config (priority high)
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.join(__dirname, envFile) });

// Load default .env as fallback
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });




const app = express();
app.set('trust proxy', 1);

// app.use((req, res, next) => {
//     const host = req.headers.host;

//     if (host === 'indiaipo.in') {
//         return res.redirect(301, `https://.indiaipo.in${req.originalUrl}`);
//     }

//     next();
// });
const PORT = process.env.PORT || 5000;


const uploadsEnvPath = process.env.UPLOADS_PATH || './uploads';
const resolvedUploadsPath = path.resolve(__dirname, uploadsEnvPath);

console.log(`📁 Uploads serving from: ${resolvedUploadsPath} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);


app.use(
    "/uploads",
    express.static(resolvedUploadsPath, {
        maxAge: 31536000000, // 365 days
        immutable: true,
    })
);


app.get('/Annual_Report.pdf', (req, res) => {
    const possiblePaths = [
        path.resolve(__dirname, '..', 'public', 'Annual_Report.pdf'),
        path.resolve(__dirname, 'public', 'Annual_Report.pdf'),
        path.join(distDir, 'Annual_Report.pdf'),
        path.resolve(process.cwd(), 'public', 'Annual_Report.pdf'),
        path.resolve(process.cwd(), 'dist', 'Annual_Report.pdf'),
    ];

    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            console.log(`✅ Serving PDF from: ${filePath}`);
            return res.download(filePath, 'Annual_Report.pdf');
        }
    }

    console.error(`❌ PDF NOT found! Searched: ${possiblePaths.join(', ')}`);
    res.status(404).send('Annual Report PDF not found on server.');
});

app.get('/logo.png', (req, res) => {
    const possiblePaths = [
        path.resolve(__dirname, '..', 'public', 'logo.png'),
        path.resolve(__dirname, 'public', 'logo.png'),
        path.join(distDir, 'logo.png'),
        path.resolve(process.cwd(), 'public', 'logo.png'),
    ];

    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    res.status(404).send('Logo not found');
});

app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    const possiblePaths = [
        path.resolve(__dirname, '..', 'public', 'favicon.png'),
        path.resolve(__dirname, 'public', 'favicon.png'),
        path.join(distDir, 'favicon.png'),
        path.resolve(process.cwd(), 'public', 'favicon.png'),
    ];

    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    res.status(404).send('Favicon not found');
});


const allowedOrigins = [
    'https://www.indiaipo.in',
    'https://indiaipo.in',
    "http://localhost:3000",
    'https://api.indiaipo.in',
    'http://api.indiaipo.in',
    'http://www.indiaipo.in',
    'https://lightgrey-salmon-166369.hostingersite.com',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {

        // Allow requests without origin
        // (Postman, mobile apps, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        if (origin.includes('translate.goog')) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("❌ CORS blocked for origin:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ],

    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


app.disable('x-powered-by');

// Initialize MySQL tables
async function initDB() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Connected to MySQL successfully');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS hero_banners (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) DEFAULT NULL,
                subtitle TEXT,
                image_url VARCHAR(512) DEFAULT NULL,
                mobile_image_url VARCHAR(512) DEFAULT NULL,
                video_url VARCHAR(512) DEFAULT NULL,
                cta_text VARCHAR(255),
                cta_link VARCHAR(512),
                badge_text VARCHAR(255) DEFAULT '',
                cta2_text VARCHAR(255) DEFAULT '',
                cta2_link VARCHAR(512) DEFAULT '',
                page_path VARCHAR(255) DEFAULT NULL,
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: Make hero_banners.title optional
        try {
            await conn.execute(`ALTER TABLE hero_banners MODIFY COLUMN title VARCHAR(255) DEFAULT NULL`);
            console.log('✅ hero_banners.title made optional (nullable)');
        } catch (e) {
            // Column may already be nullable or other error
        }

        // Migration: Add mobile_image_url column to hero_banners if it doesn't exist
        try {
            await conn.execute(`ALTER TABLE hero_banners ADD COLUMN mobile_image_url VARCHAR(512) DEFAULT NULL AFTER image_url`);
            console.log('✅ Added mobile_image_url column to hero_banners');
        } catch (e) {
            // Column likely already exists
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed default admin if it doesn't exist
        const [adminRows] = await conn.execute('SELECT id FROM users WHERE email = ?', ['admin@indiaipo.in']);
        if (adminRows.length === 0) {
            console.log('🌱 Seeding default admin user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            await conn.execute(
                'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
                ['Super Admin', 'admin@indiaipo.in', hashedPassword, 'Super Admin', '1']
            );
            console.log('✅ Default admin seeded (admin@indiaipo.in / admin123)');
        }


        await conn.execute(`
            CREATE TABLE IF NOT EXISTS videos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                youtube_id VARCHAR(100) NOT NULL,
                description TEXT,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS notification_pdfs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                pdf_url VARCHAR(512),
                link VARCHAR(512) DEFAULT NULL,
                description LONGTEXT,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: upgrade notification_pdfs.description to LONGTEXT (fix "data too long" error with rich text/images)
        try {
            await conn.execute(`ALTER TABLE notification_pdfs MODIFY COLUMN description LONGTEXT`);
            console.log('✅ notification_pdfs.description upgraded to LONGTEXT');
        } catch (e) {
            // Safe to ignore — column may already be LONGTEXT
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_bankers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                location VARCHAR(255) DEFAULT '',
                sebi_registration VARCHAR(255) DEFAULT '',
                website VARCHAR(512) DEFAULT '',
                services TEXT,
                total_ipos INT DEFAULT 0,
                established_year INT DEFAULT NULL,
                description TEXT,
                logo_url VARCHAR(512) DEFAULT NULL,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                total_raised DECIMAL(15,2) DEFAULT 0,
                avg_size DECIMAL(15,2) DEFAULT 0,
                avg_subscription DECIMAL(15,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS banker_subcategories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                type VARCHAR(50) NOT NULL, -- 'sme' or 'mainboard'
                status VARCHAR(50) DEFAULT 'active', -- 'active' or 'inactive'
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Check if banker_subcategories is empty, seed defaults
        const [subcatRows] = await conn.execute('SELECT COUNT(*) as count FROM banker_subcategories');
        if (subcatRows[0].count === 0) {
            await conn.execute("INSERT INTO banker_subcategories (name, slug, type, status) VALUES ('List of SME Merchant Bankers', 'list-of-sme-merchant-bankers', 'sme', 'active')");
            await conn.execute("INSERT INTO banker_subcategories (name, slug, type, status) VALUES ('List of Mainboard Merchant Bankers', 'list-of-mainboard-merchant-bankers', 'mainboard', 'active')");
        }

        // Ensure marchantbankers (legacy table with 'a') has established_year
        try {
            // Check if column exists first for better compatibility
            const [cols] = await conn.execute("SHOW COLUMNS FROM marchantbankers LIKE 'established_year'");
            if (cols.length === 0) {
                await conn.execute("ALTER TABLE marchantbankers ADD COLUMN established_year INT DEFAULT NULL");
                console.log("✅ Added established_year column to marchantbankers");
            }
        } catch (e) {
            console.log("⚠️ marchantbankers column adjustment error:", e.message);
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS leads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20) DEFAULT '',
                company VARCHAR(255) DEFAULT '',
                message TEXT NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS report_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                icon VARCHAR(100) DEFAULT 'FileText',
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS report_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                logo_url VARCHAR(512) DEFAULT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(100) DEFAULT 'Upcoming',
                status_color VARCHAR(50) DEFAULT 'blue',
                estimated_amount VARCHAR(255) DEFAULT '',
                exchange VARCHAR(100) DEFAULT '',
                sector VARCHAR(255) DEFAULT '',
                description TEXT,
                drhp_link VARCHAR(512) DEFAULT '',
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES report_categories(id) ON DELETE CASCADE
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS knowledge_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                icon VARCHAR(100),
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS knowledge_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                subtitle VARCHAR(255),
                col1 TEXT,
                col2 TEXT,
                col3 TEXT,
                col4 TEXT,
                col5 TEXT,
                col6 TEXT,
                link VARCHAR(512),
                location VARCHAR(255),
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS blogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                excerpt TEXT,
                content LONGTEXT,
                category VARCHAR(100) DEFAULT '',
                status VARCHAR(50) DEFAULT 'draft',
                image_url VARCHAR(512) DEFAULT NULL,
                author VARCHAR(255) DEFAULT 'Admin',
                tags VARCHAR(500) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS site_popup (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) DEFAULT '',
                description TEXT,
                image_url VARCHAR(512),
                button_text VARCHAR(100) DEFAULT 'Read More',
                button_link VARCHAR(512) DEFAULT '#',
                is_active TINYINT(1) DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS consultants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                image_url VARCHAR(512),
                experience_years INT DEFAULT 0,
                specialization VARCHAR(255),
                office_location VARCHAR(255),
                success_stories TEXT,
                tags VARCHAR(500),
                cemail VARCHAR(255) DEFAULT '',
                cmobile VARCHAR(20) DEFAULT '',
                caddress TEXT,
                cweblink VARCHAR(512) DEFAULT '',
                meta_title VARCHAR(255) DEFAULT '',
                meta_desc TEXT,
                meta_keywords TEXT,
                methodology LONGTEXT,
                roadmap LONGTEXT,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add missing columns to consultants if they don't exist
        const columnsToAdd = [
            ['slug', 'VARCHAR(255)'],
            ['cemail', 'VARCHAR(255) DEFAULT \'\''],
            ['cmobile', 'VARCHAR(20) DEFAULT \'\''],
            ['caddress', 'TEXT'],
            ['cweblink', 'VARCHAR(512) DEFAULT \'\''],
            ['meta_title', 'VARCHAR(255) DEFAULT \'\''],
            ['meta_desc', 'TEXT'],
            ['meta_keywords', 'TEXT'],
            ['methodology', 'LONGTEXT'],
            ['roadmap', 'LONGTEXT']
        ];

        for (const [col, type] of columnsToAdd) {
            try {
                await conn.execute(`ALTER TABLE consultants ADD COLUMN IF NOT EXISTS ${col} ${type}`);
            } catch (e) {
                try {
                    await conn.execute(`ALTER TABLE consultants ADD COLUMN ${col} ${type}`);
                } catch (innerError) {
                    // Column likely already exists
                }
            }
        }

        // Populate slugs for existing consultants if they are empty
        try {
            const [existingConsultants] = await conn.execute('SELECT id, name, slug FROM consultants WHERE slug IS NULL OR slug = \'\'');
            for (const c of existingConsultants) {
                const generatedSlug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + c.id;
                await conn.execute('UPDATE consultants SET slug = ? WHERE id = ?', [generatedSlug, c.id]);
            }

            // Now make slug NOT NULL and UNIQUE
            await conn.execute('ALTER TABLE consultants MODIFY COLUMN slug VARCHAR(255) NOT NULL UNIQUE');
            console.log('✅ Updated existing consultants with unique slugs and added constraint');
        } catch (e) {
            console.log('ℹ️ Slug column update skipped or already applied:', e.message);
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS consultant_enquiries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                consultant_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20) DEFAULT '',
                organisation VARCHAR(255) DEFAULT '',
                message TEXT NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_contact_enquiries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ipo_type VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                mobile VARCHAR(20) DEFAULT '',
                company VARCHAR(255) DEFAULT '',
                message TEXT NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS seo_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                meta_title VARCHAR(255) DEFAULT '',
                meta_description TEXT,
                keywords TEXT,
                og_image VARCHAR(512) DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Check if seo_settings exists, if not seed it
        const [seoRows] = await conn.execute('SELECT COUNT(*) as count FROM seo_settings');
        if (seoRows[0].count === 0) {
            await conn.execute('INSERT INTO seo_settings (meta_title, meta_description, keywords, og_image) VALUES (?, ?, ?, ?)',
                [
                    "India IPO - India's Leading IPO Consultancy Platform",
                    "Expert advisory for SME IPO, Mainline IPO, FPO, and Pre-IPO funding. Navigate Indian capital markets with confidence.",
                    "IPO, SME IPO, Mainline IPO, FPO, Pre-IPO, Indian Stock Market, SEBI, IPO Consultancy",
                    ""
                ]
            );
        }
        const [popupRows] = await conn.execute('SELECT COUNT(*) as count FROM site_popup');
        if (popupRows[0].count === 0) {
            await conn.execute('INSERT INTO site_popup (title, description, image_url, button_text, button_link, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                ['New Release', 'Check out our latest news!', null, 'Learn More', '#', 0]);
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS registrar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                image VARCHAR(512),
                slug VARCHAR(255) NOT NULL UNIQUE,
                meta_title VARCHAR(255) DEFAULT '',
                meta_desc TEXT,
                meta_keywords TEXT,
                sme_ipo VARCHAR(100) DEFAULT '0',
                mainboard_ipo VARCHAR(100) DEFAULT '0',
                sme_ipo_parentage VARCHAR(100) DEFAULT '0',
                mainboard_ipo_parentage VARCHAR(100) DEFAULT '0',
                avgsubscription_sme VARCHAR(100) DEFAULT '0',
                avgsubscription_mainboard VARCHAR(100) DEFAULT '0',
                location VARCHAR(255) DEFAULT '',
                dic LONGTEXT,
                registrar_year VARCHAR(50) DEFAULT '',
                latest_sme VARCHAR(512) DEFAULT '',
                latest_mainbord VARCHAR(512) DEFAULT '',
                faqs LONGTEXT,
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS admin_blogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                new_slug VARCHAR(255) DEFAULT NULL UNIQUE,
                image VARCHAR(512) NOT NULL,
                content LONGTEXT,
                faqs LONGTEXT,
                user_id INT DEFAULT 1,
                status VARCHAR(50) DEFAULT 'draft',
                confidential VARCHAR(10) DEFAULT '0',
                upcoming VARCHAR(10) DEFAULT '0',
                category VARCHAR(100) DEFAULT '',
                new_highlight_text TEXT,
                gmp_date JSON DEFAULT NULL,
                gmp_ipo_price JSON DEFAULT NULL,
                gmp JSON DEFAULT NULL,
                gmp_last_updated JSON DEFAULT NULL,
                ipo_details LONGTEXT,
                ipo_description LONGTEXT,
                ipo_timeline_details LONGTEXT,
                ipo_timeline_description LONGTEXT,
                ipo_lots_application LONGTEXT,
                ipo_lots LONGTEXT,
                ipo_lots_share LONGTEXT,
                ipo_lots_amount LONGTEXT,
                promotor_hold_pre_issue VARCHAR(100),
                promotor_hold_post_issue VARCHAR(100),
                finantial_information_ended LONGTEXT,
                finantial_information_assets LONGTEXT,
                finantial_information_revenue LONGTEXT,
                finantial_information_profit_tax LONGTEXT,
                financial_info_reserves_surplus LONGTEXT,
                finantial_information_networth LONGTEXT,
                finantial_information_borrowing LONGTEXT,
                key_kpi LONGTEXT,
                key_value LONGTEXT,
                key_pri_ipo_eps LONGTEXT,
                key_pos_ipo_eps LONGTEXT,
                key_pre_ipo_pe LONGTEXT,
                key_post_ipo_pe LONGTEXT,
                competative_strenght LONGTEXT,
                meta_title VARCHAR(255),
                description TEXT,
                keyword TEXT,
                rhp VARCHAR(512),
                drhp VARCHAR(512),
                confidential_drhp VARCHAR(512),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add fields for daily reporter category
        const adminBlogCols = [
            ['state', 'VARCHAR(100) DEFAULT NULL'],
            ['city', 'VARCHAR(100) DEFAULT NULL'],
            ['pincode', 'VARCHAR(20) DEFAULT NULL'],
            ['drhp_status', 'VARCHAR(10) DEFAULT NULL'],
            ['linked_digest_id', 'INT DEFAULT NULL'],
            ['recent_ipo_updates', 'LONGTEXT DEFAULT NULL'],
            ['pe_funding_updates', 'LONGTEXT DEFAULT NULL'],
            ['business_economic_updates', 'LONGTEXT DEFAULT NULL'],
            ['geopolitical_updates', 'LONGTEXT DEFAULT NULL']
        ];
        for (const [col, type] of adminBlogCols) {
            try {
                await conn.execute(`ALTER TABLE admin_blogs ADD COLUMN IF NOT EXISTS ${col} ${type}`);
            } catch (e) {
                try {
                    await conn.execute(`ALTER TABLE admin_blogs ADD COLUMN ${col} ${type}`);
                } catch (inner) { }
            }
        }

        // Migration: Fix created_at and updated_at defaults in admin_blogs
        try {
            await conn.execute(`
                UPDATE admin_blogs 
                SET created_at = NOW() 
                WHERE created_at IS NULL 
                   OR created_at < '1970-01-02 00:00:00'
            `);
            await conn.execute(`
                UPDATE admin_blogs 
                SET updated_at = NOW() 
                WHERE updated_at IS NULL 
                   OR updated_at < '1970-01-02 00:00:00'
            `);
            await conn.execute(`
                ALTER TABLE admin_blogs 
                MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            await conn.execute(`
                ALTER TABLE admin_blogs 
                MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            `);
            console.log('✅ Fixed timestamp columns and default values in admin_blogs');
        } catch (e) {
            console.log('ℹ️ Timestamp column alter skipped or already updated in admin_blogs:', e.message);
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS sectors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'Active',
                pe_heigest DECIMAL(15,2) DEFAULT 0,
                pe_median DECIMAL(15,2) DEFAULT 0,
                pe_lowest DECIMAL(15,2) DEFAULT 0,
                ipo_size_heigest DECIMAL(15,2) DEFAULT 0,
                ipo_size_median DECIMAL(15,2) DEFAULT 0,
                ipo_size_lowest DECIMAL(15,2) DEFAULT 0,
                mainline_pe_heigest DECIMAL(15,2) DEFAULT 0,
                mainline_pe_median DECIMAL(15,2) DEFAULT 0,
                mainline_pe_lowest DECIMAL(15,2) DEFAULT 0,
                mainline_ipo_size_heigest DECIMAL(15,2) DEFAULT 0,
                mainline_ipo_size_median DECIMAL(15,2) DEFAULT 0,
                mainline_ipo_size_lowest DECIMAL(15,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS ipo_lists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                logo VARCHAR(512),
                issuer_company VARCHAR(255) NOT NULL,
                date_declared VARCHAR(50) DEFAULT '1',
                open_date DATE,
                close_date DATE,
                listing_date DATE,
                merchant_bankers TEXT,
                issue_lowest_price DECIMAL(15,2) DEFAULT 0,
                issue_highest_price DECIMAL(15,2) DEFAULT 0,
                issue_size DECIMAL(15,2) DEFAULT 0,
                lot_size INT DEFAULT 0,
                exchange VARCHAR(100),
                gmp DECIMAL(15,2) DEFAULT 0,
                issue_category VARCHAR(100),
                sector_id INT,
                merchant_banker VARCHAR(255),
                current_price DECIMAL(15,2) DEFAULT 0,
                ipo_pe_ratio DECIMAL(15,2),
                listing_day_close_bse DECIMAL(15,2) DEFAULT 0,
                listing_day_close_nse DECIMAL(15,2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Active',
                upcoming VARCHAR(10) DEFAULT '0',
                confidential VARCHAR(10) DEFAULT '0',
                upcoming_ipo_status VARCHAR(255),
                admin_blog_id INT,
                listing_day_gain_percentage VARCHAR(255) DEFAULT NULL,
                listing_price VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add listing_day_gain_percentage to ipo_lists if it doesn't exist
        try {
            await conn.execute(`ALTER TABLE ipo_lists ADD COLUMN listing_day_gain_percentage VARCHAR(255) DEFAULT NULL`);
            console.log('✅ Added listing_day_gain_percentage to ipo_lists');
        } catch (err) {
            // Suppress error if column already exists, but modify its type just in case
            try {
                await conn.execute(`ALTER TABLE ipo_lists MODIFY COLUMN listing_day_gain_percentage VARCHAR(255) DEFAULT NULL`);
            } catch (err2) { }
        }

        // Migration: Add listing_price to ipo_lists if it doesn't exist
        try {
            await conn.execute(`ALTER TABLE ipo_lists ADD COLUMN listing_price VARCHAR(255) DEFAULT NULL`);
            console.log('✅ Added listing_price to ipo_lists');
        } catch (err) {
            // Suppress error if column already exists
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS ipo_sector_links (
                ipo_id INT,
                sector_id INT,
                PRIMARY KEY (ipo_id, sector_id),
                FOREIGN KEY (ipo_id) REFERENCES ipo_lists(id) ON DELETE CASCADE,
                FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS daily_digests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                image VARCHAR(512),
                pdf VARCHAR(512),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS weekly_digests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                image VARCHAR(512),
                pdf VARCHAR(512),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS api_news (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description VARCHAR(500),
                content LONGTEXT,
                published_at DATE,
                image VARCHAR(512),
                category VARCHAR(100),
                latest_news TINYINT(1) DEFAULT 0,
                trending_news TINYINT(1) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'published',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS career (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                last_name VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                position_applied VARCHAR(255),
                experience VARCHAR(255),
                resume VARCHAR(512),
                coverletter TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS career_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed default roles if empty
        const [roleRows] = await conn.execute('SELECT COUNT(*) as count FROM career_roles');
        if (roleRows[0].count === 0) {
            console.log('🌱 Seeding default career roles...');
            const defaultRoles = [
                'CEO',
                'Business Analyst',
                'MERN Stack Developer',
                'IPO Advisory Specialist',
                'Sales Executive',
                'HR Manager',
                'SEO & Content Writer'
            ];
            for (const r of defaultRoles) {
                await conn.execute('INSERT INTO career_roles (title, is_active) VALUES (?, 1)', [r]);
            }
            console.log('✅ Seeded 7 default career roles');
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS magzine (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                pdf VARCHAR(512),
                language VARCHAR(50) DEFAULT 'english',
                pdf_lock VARCHAR(10) DEFAULT '1',
                report_images TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS visitors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                form_type VARCHAR(50) NOT NULL,
                name VARCHAR(255),
                email VARCHAR(255),
                mobile VARCHAR(50),
                cname VARCHAR(255),
                designation VARCHAR(255),
                turnover VARCHAR(255),
                subject VARCHAR(255),
                message TEXT,
                consultant_id INT,
                ipo_type VARCHAR(100),
                request_count INT DEFAULT 1,
                is_read TINYINT(1) DEFAULT 0,
                is_subscribed TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ visitors table verified');

        // Migration: Add missing columns if they don't exist
        const visitorCols = [
            ['is_subscribed', 'TINYINT(1) DEFAULT 1'],
            ['is_read', 'TINYINT(1) DEFAULT 0'],
            ['designation', 'VARCHAR(255)'],
            ['turnover', 'VARCHAR(255)'],
            ['ipo_type', 'VARCHAR(100)'],
            ['consultant_id', 'INT'],
            ['subject', 'VARCHAR(255)'],
            ['request_count', 'INT DEFAULT 1']
        ];

        for (const [col, type] of visitorCols) {
            try {
                await conn.execute(`ALTER TABLE visitors ADD COLUMN ${col} ${type}`);
                console.log(`✅ Added column ${col} to visitors`);
            } catch (e) {
                // Column probably already exists, try to modify it to ensure correct default/type
                try {
                    await conn.execute(`ALTER TABLE visitors MODIFY COLUMN ${col} ${type}`);
                } catch (err2) {
                    // Skip if fails
                }
            }
        }

        // Specifically fix created_at and updated_at defaults
        try {
            await conn.execute(`ALTER TABLE visitors MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
            await conn.execute(`ALTER TABLE visitors MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

            // Fix existing NULL values so they don't show as 1970
            await conn.execute(`UPDATE visitors SET created_at = NOW() WHERE created_at IS NULL`);
            await conn.execute(`UPDATE visitors SET updated_at = NOW() WHERE updated_at IS NULL`);

            console.log('✅ Fixed timestamp defaults and updated existing NULLs in visitors');
        } catch (e) {
            console.error('Error fixing timestamp defaults:', e);
        }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS jobs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                queue VARCHAR(255) NOT NULL,
                payload LONGTEXT NOT NULL,
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                reserved_at INT UNSIGNED DEFAULT NULL,
                available_at INT UNSIGNED NOT NULL,
                created_at INT UNSIGNED NOT NULL,
                INDEX (queue)
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS processed_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                connection_name VARCHAR(255),
                queue VARCHAR(255),
                job_name VARCHAR(255),
                digest_id INT,
                user_email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                processed_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (digest_id),
                INDEX (user_email)
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS failed_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(255) UNIQUE,
                connection VARCHAR(255),
                queue VARCHAR(255),
                payload LONGTEXT,
                exception LONGTEXT,
                digest_id INT,
                user_email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                failed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX (digest_id),
                INDEX (user_email)
            )
        `);

        // Migration: Add missing columns to processed_jobs and failed_jobs if they don't exist
        const processedJobsCols = [
            ['connection_name', 'VARCHAR(255)'],
            ['job_name', 'VARCHAR(255)'],
            ['digest_id', 'INT'],
            ['user_email', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'],
            ['processed_at', 'DATETIME']
        ];

        for (const [col, type] of processedJobsCols) {
            try {
                await conn.execute(`ALTER TABLE processed_jobs ADD COLUMN \`${col}\` ${type}`);
                console.log(`✅ Added column ${col} to processed_jobs`);
            } catch (e) {
                try {
                    await conn.execute(`ALTER TABLE processed_jobs MODIFY COLUMN \`${col}\` ${type}`);
                } catch (err2) { }
            }
        }

        // Add indices for processed_jobs
        try {
            await conn.execute(`ALTER TABLE processed_jobs ADD INDEX (digest_id)`);
        } catch (e) { }
        try {
            await conn.execute(`ALTER TABLE processed_jobs ADD INDEX (user_email)`);
        } catch (e) { }

        const failedJobsCols = [
            ['uuid', 'VARCHAR(255)'],
            ['connection', 'VARCHAR(255)'],
            ['digest_id', 'INT'],
            ['user_email', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci']
        ];

        for (const [col, type] of failedJobsCols) {
            try {
                await conn.execute(`ALTER TABLE failed_jobs ADD COLUMN \`${col}\` ${type}`);
                console.log(`✅ Added column ${col} to failed_jobs`);
            } catch (e) {
                try {
                    await conn.execute(`ALTER TABLE failed_jobs MODIFY COLUMN \`${col}\` ${type}`);
                } catch (err2) { }
            }
        }

        // Add indices for failed_jobs
        try {
            await conn.execute(`ALTER TABLE failed_jobs ADD INDEX (digest_id)`);
        } catch (e) { }
        try {
            await conn.execute(`ALTER TABLE failed_jobs ADD INDEX (user_email)`);
        } catch (e) { }

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS annual_report_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                request_count INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS sme_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exchange_type VARCHAR(20) NOT NULL,
                sno VARCHAR(50),
                company_name VARCHAR(255) NOT NULL,
                ipo_date VARCHAR(100),
                exchanges VARCHAR(255),
                merchant_banker VARCHAR(255),
                ipo_size VARCHAR(100),
                migration_date VARCHAR(100),
                issue_price VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        conn.release();
        console.log('✅ All MySQL tables initialized (including IPO lists, Admin Blogs, News, etc)');

        // SEED CONSULTANTS if empty
        const [consultantRows] = await conn.execute('SELECT COUNT(*) as count FROM consultants');
        if (consultantRows[0].count === 0) {
            console.log('🌱 Seeding default consultants...');
            const defaultConsultants = [
                ['Kolkata IPO Advisors', 'ipo-advisory-in-kolkata-for-business', 'Expert IPO consultancy in Kolkata providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267713545-8081384.webp', 0, '', 'Kolkata', '', '', 1, 0],
                ['Pune Capital IPO Consultants', 'pune-capital-ipo-consultants', 'Expert IPO consultancy in Pune providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267744482-148204196.webp', 0, '', 'Pune', '', '', 1, 1],
                ['Bangalore Growth IPO Experts', 'bangalore-growth-ipo-experts', 'Expert IPO consultancy in Bangalore providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267752764-273443983.webp', 0, '', 'Bangalore', '', '', 1, 2],
                ['Mumbai Prime IPO Advisory', 'mumbai-prime-ipo-advisory', 'Expert IPO consultancy in Mumbai providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267760591-208478730.webp', 0, '', 'Mumbai', '', '', 1, 3],
                ['Ahmedabad Equity IPO Consultants', 'ahmedabad-equity-ipo-consultants', 'Expert IPO consultancy in Ahmedabad providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267769460-312859.jpg', 0, '', 'Ahmedabad', '', '', 1, 4],
                ['Delhi NCR IPO Advisory Group', 'delhi-ncr-ipo-advisory-group', 'Expert IPO consultancy in Delhi NCR providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267777443-183671010.jpg', 0, '', 'Delhi NCR', '', '', 1, 5],
                ['Hyderabad IPO Strategy Hub', 'hyderabad-ipo-strategy-hub', 'Expert IPO consultancy in Hyderabad providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267785104-366740161.jpg', 0, '', 'Hyderabad', '', '', 1, 6],
                ['Chennai IPO Consulting Solutions', 'chennai-ipo-consulting-solutions', 'Expert IPO consultancy in Chennai providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267792155-286720304.jpg', 0, '', 'Chennai', '', '', 1, 7],
                ['Delhi Capital IPO Experts', 'delhi-capital-ipo-experts', 'Expert IPO consultancy in Delhi providing end-to-end support for SME and Mainboard public listings.', 'uploads/consultant/1774267799084-110468511.jpg', 0, '', 'Delhi', '', '', 1, 8]
            ];

            for (const c of defaultConsultants) {
                await conn.execute(
                    `INSERT INTO consultants (name, slug, description, image_url, experience_years, specialization, office_location, success_stories, tags, is_active, sort_order) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    c
                );
            }
            console.log('✅ Seeded 9 consultants');
        }
    } catch (err) {
        console.error('❌ MySQL initialization error (CRITICAL):', err.message);
        console.error('Check your .env file and database availability.');
        // Don't process.exit(1) if you want the server to stay alive for health checks/static logs
        // but it's better to keep it failed so nodemon restarts on fix
        process.exit(1);
    }
}


// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running with MySQL' });
});

app.get("/api/run-news-cron", async (req, res) => {
    if (req.query.key !== "Indiaipo@123" && req.query.key !== "indiaipo@123") {
        return res.status(403).send("Unauthorized");
    }

    await fetchAndSaveNews();
    res.send("✅ Done");
});

app.get("/api/run-daily-digest-cron", async (req, res) => {
    if (req.query.key !== "Indiaipo@123" && req.query.key !== "indiaipo@123") {
        return res.status(403).send("Unauthorized");
    }

    try {
        console.log("🔔 Daily digest cron API triggered");
        let jobsLeft = true;
        let totalProcessed = 0;
        while (jobsLeft) {
            const count = await processJobs();
            totalProcessed += count;
            if (count === 0) jobsLeft = false;
        }
        res.send(`✅ Daily digest cron processed successfully. Total jobs processed: ${totalProcessed}`);
    } catch (error) {
        console.error("❌ Error running daily digest cron via API:", error);
        res.status(500).send(`Error: ${error.message}`);
    }
});


// Import Merchant Enquiries Route
import merchantEnquiryRoutes from './routes/merchant_contact_enquiries.mjs';

// Centralized Admin Authentication Middleware
app.use('/api', (req, res, next) => {
    const path = req.originalUrl.split('?')[0];
    const method = req.method;

    if (method === 'OPTIONS') {
        return next();
    }

    // 1. Identify public POST endpoints
    const publicPostEndpoints = [
        /^\/api\/auth\/(login|register|forgot-password|reset-password)\/?$/i,
        /^\/api\/leads\/?$/i,
        /^\/api\/subscriptions\/?$/i,
        /^\/api\/consultant-enquiries\/?$/i,
        /^\/api\/merchant-contact-enquiries\/?$/i,
        /^\/api\/annual-report-requests\/?$/i,
        /^\/api\/ipo_feasibility\/?$/i,
        /^\/api\/career\/apply\/?$/i,
        /^\/api\/career\/?$/i,
        /^\/api\/investor\/?$/i,
        /^\/api\/upload\/?$/i
    ];

    const isAdminOnlyGetEndpoint = (path) => {
        // Paths for GET that require admin authentication
        const adminGetPatterns = [
            /^\/api\/dashboard\/stats\/?$/i,
            /^\/api\/users/i,
            /^\/api\/leads(\/unread|\/|$)/i,
            /^\/api\/consultant-enquiries(\/unread|\/|$)/i,
            /^\/api\/merchant-contact-enquiries(\/unread|\/|$)/i,
            /^\/api\/annual-report-requests(\/unread|\/|$)/i,
            /^\/api\/ipo_feasibility(\/unread|\/|$)/i,
            /^\/api\/career\/admin/i,
            /^\/api\/career(\/unread)?\/?$/i,
            /^\/api\/investor(\/unread|\/|$)/i,
            /^\/api\/subscriptions(\/unread|\/|$)/i,
            /^\/api\/admin-blogs\/id\//i,
            /^\/api\/consultants\/id\//i,
            /^\/api\/sectors\/admin\/?$/i,
            /^\/api\/sectors\/ipos\/list\/?$/i,
        ];

        return adminGetPatterns.some(pattern => pattern.test(path));
    };

    // Check GET requests
    if (method === 'GET') {
        if (isAdminOnlyGetEndpoint(path)) {
            return authenticateAdmin(req, res, next);
        }
        return next();
    }

    // Check POST requests
    if (method === 'POST') {
        const isPublic = publicPostEndpoints.some(pattern => pattern.test(path));
        if (isPublic) {
            return next();
        }
        return authenticateAdmin(req, res, next);
    }

    // Enforce authentication for all other mutating requests (PUT, DELETE, PATCH)
    if (['PUT', 'DELETE', 'PATCH'].includes(method)) {
        return authenticateAdmin(req, res, next);
    }

    next();
});

// API Routes
app.use('/api/videos', videoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bankers', bankerRoutes);
app.use('/api/banker-subcategories', bankerSubcategoryRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/social_media', socialMediaRoutes);
app.use('/api/ipo_feasibility', ipoFeasibilityRoutes);
app.use('/api/csr', csrRoutes);
app.use('/api/mainboard-bankers', mainboardBankerRoutes);
app.use('/api/career', careerRoutes);
// Auto-regenerate sitemaps after any admin_blogs write (non-blocking)
app.use('/api/admin-blogs', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        res.on('finish', () => {
            if (res.statusCode < 400) {
                setImmediate(() => {
                    generateAndSaveSitemaps().catch(e => console.error('❌ Sitemap auto-regen error:', e.message));
                });
            }
        });
    }
    next();
});
app.use('/api/admin-blogs', adminBlogsRoutes);

app.use('/api/popup', popupRoutes);
app.use('/api/registrars', registrarRoutes);
app.use('/api/registrar-faqs', registrarFaqRoutes);
app.use('/api/daily-digests', dailyDigestRoutes);
app.use('/api/weekly-digests', weeklyDigestRoutes);
app.use('/api/ipo-lists', ipoListRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/consultants', consultantRoutes);
app.use('/api/consultant-enquiries', consultantEnquiryRoutes);
app.use('/api/magazines', magazineRoutes);
app.use('/api/merchant-contact-enquiries', merchantEnquiryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/seo-pages', seoPagesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/annual-report-requests', annualReportRequestRoutes);
app.use('/api/sme-migrations', smeMigrationRoutes);
app.use(
    '/api/upload/magazine',
    uploadMagazineRoutes
);

app.use(
    '/api/upload/daily-reporter',
    uploadDailyReporterRoutes
);

app.use(
    '/api/upload/weekly-reporter',
    uploadWeeklyReporterRoutes
);


export async function generateAndSaveSitemaps() {
    try {
        const baseUrl = 'https://www.indiaipo.in';
        const today = new Date().toISOString().split('T')[0];

        const fmt = (d) => { if (!d) return today; const dt = new Date(d); return isNaN(dt.getTime()) ? today : dt.toISOString().split('T')[0]; };
        const toSlug = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const escXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const urlEntry = (loc, lastmod, freq, priority) =>
            `  <url>\n    <loc>${escXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;

        const conn = await pool.getConnection();

        // ── Fetch all data ─────────────────────────────────────
        // Fetch category too so we can assign correct URL prefix
        const [allAdminBlogs] = await conn.execute('SELECT slug, new_slug, updated_at, category FROM admin_blogs ORDER BY updated_at DESC');
        const [ipoListsWithBlogs] = await conn.execute(
            `SELECT il.updated_at, ab.slug, ab.new_slug, ab.category FROM ipo_lists il
             JOIN admin_blogs ab ON il.admin_blog_id = ab.id
             WHERE il.admin_blog_id IS NOT NULL ORDER BY il.updated_at DESC`
        );
        const [regularBlogs] = await conn.execute('SELECT slug, updated_at FROM blogs ORDER BY updated_at DESC');
        const [registrars] = await conn.execute('SELECT slug, update_at FROM registrar WHERE status = "Active"');
        const [newsArticles] = await conn.execute('SELECT slug, updated_at FROM api_news ORDER BY updated_at DESC LIMIT 500');
        const [consultants] = await conn.execute('SELECT slug, updated_at FROM consultants WHERE is_active = 1');
        const [ipoDetails] = await conn.execute('SELECT id, updated_at FROM ipo_lists WHERE status != "Inactive" ORDER BY updated_at DESC');
        const [sectorPages] = await conn.execute('SELECT name, updated_at FROM sectors WHERE status = "Active" ORDER BY name ASC');
        const [merchantBankers] = await conn.execute('SELECT slug, updated_at FROM marchantbankers WHERE slug IS NOT NULL AND slug != ""');
        conn.release();

        // ── Category → URL mapping ─────────────────────────────────
        // ipo_updates  → /ipo-blogs/:slug  (IPO company blogs)
        // ipo_blogs    → /blogs/:slug      (Article/knowledge blogs)
        // city_blogs   → /consultant/:slug  (already in pages via consultants table)
        // daily_reporter → /daily-reporter/:slug
        // news (admin) → excluded (different from api_news table)
        const ipoBlogsEntries = allAdminBlogs.filter(b => b.category === 'ipo_updates');
        const articleBlogsEntries = allAdminBlogs.filter(b => b.category === 'ipo_blogs');

        // ── 1. ipo-blogs-sitemap.xml  (IPO company blogs → /ipo-blogs/) ──
        let ipoBlogXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        ipoBlogXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        const seenIpoSlugs = new Set();
        ipoBlogsEntries.forEach(blog => {
            const activeSlug = blog.new_slug || blog.slug;
            if (activeSlug && !seenIpoSlugs.has(activeSlug)) {
                seenIpoSlugs.add(activeSlug);
                ipoBlogXml += urlEntry(`${baseUrl}/ipo-blogs/${activeSlug}`, fmt(blog.updated_at), 'weekly', '0.9');
            }
        });
        ipoListsWithBlogs.forEach(item => {
            if (item.category === 'ipo_blogs') return; // These go to article-blogs
            const activeSlug = item.new_slug || item.slug;
            if (activeSlug && !seenIpoSlugs.has(activeSlug)) {
                seenIpoSlugs.add(activeSlug);
                ipoBlogXml += urlEntry(`${baseUrl}/ipo-blogs/${activeSlug}`, fmt(item.updated_at), 'weekly', '0.9');
            }
        });
        ipoBlogXml += `</urlset>`;

        // ── 1b. article-blogs-sitemap.xml  (Article blogs → /blogs/) ──────
        let articleBlogXml = `<?xml version="1.0" encoding="UTF-8"?>
`;
        articleBlogXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
        const seenArticleSlugs = new Set();
        articleBlogsEntries.forEach(blog => {
            const activeSlug = blog.new_slug || blog.slug;
            if (activeSlug && !seenArticleSlugs.has(activeSlug)) {
                seenArticleSlugs.add(activeSlug);
                articleBlogXml += urlEntry(`${baseUrl}/blogs/${activeSlug}`, fmt(blog.updated_at), 'weekly', '0.8');
            }
        });
        articleBlogXml += `</urlset>`;

        // ── 2. news-sitemap.xml ────────────────────────────────
        let newsXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        newsXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        newsArticles.forEach(n => {
            if (n.slug) newsXml += urlEntry(`${baseUrl}/news/detail/${n.slug}`, fmt(n.updated_at), 'weekly', '0.6');
        });
        newsXml += `</urlset>`;

        // ── 3. pages-sitemap.xml (all static + service + other URLs) ──
        const staticPages = [
            { path: '', freq: 'daily', priority: '1.0' },
            { path: '/services', freq: 'weekly', priority: '0.9' },
            { path: '/ipo-blogs', freq: 'daily', priority: '0.9' },
            { path: '/all-ipos', freq: 'daily', priority: '0.9' },
            { path: '/about', freq: 'monthly', priority: '0.7' },
            { path: '/contact', freq: 'monthly', priority: '0.7' },
            { path: '/ipo-registrar-list', freq: 'weekly', priority: '0.8' },
            { path: '/merchant-bankers/list-of-sme-merchant-bankers', freq: 'weekly', priority: '0.8' },
            { path: '/merchant-bankers/list-of-mainboard-merchant-bankers', freq: 'weekly', priority: '0.8' },
            { path: '/reports', freq: 'weekly', priority: '0.7' },
            { path: '/career', freq: 'monthly', priority: '0.6' },
            { path: '/ipo-knowledge', freq: 'weekly', priority: '0.8' },
            { path: '/news', freq: 'daily', priority: '0.8' },
            { path: '/ipo-feasibility', freq: 'monthly', priority: '0.7' },
            { path: '/consultant', freq: 'weekly', priority: '0.7' },
            { path: '/mainline-ipos', freq: 'daily', priority: '0.8' },
            { path: '/sme-ipos', freq: 'daily', priority: '0.8' },
            { path: '/sme-ipo-sector', freq: 'daily', priority: '0.8' },
            { path: '/mainboard-ipo-sector', freq: 'daily', priority: '0.8' },
            { path: '/ipo-process', freq: 'weekly', priority: '0.8' },
            { path: '/pre-ipo-process-guidance', freq: 'weekly', priority: '0.8' },
            { path: '/sector-wise-ipo-list-in-india', freq: 'weekly', priority: '0.8' },
        ];
        const serviceSlugs = [
            'business-valuation-services', 'corporate-finance-services', 'financial-modelling-services', 'project-finance-services',
            'ma-advisory', 'capital-structuring', 'debt-syndication-services', 'equity-fundraising',
            'sme-ipo-consultant', 'mainline-ipo-consultant', 'fpo', 'pre-ipo-consultant', 'general-ipo-advisory',
            'ipo-readiness', 'drhp-preparation', 'sebi-compliance'
        ];

        let pagesXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        pagesXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        staticPages.forEach(p => { pagesXml += urlEntry(`${baseUrl}${p.path}`, today, p.freq, p.priority); });
        serviceSlugs.forEach(slug => { pagesXml += urlEntry(`${baseUrl}/services/${slug}`, today, 'monthly', '0.8'); });
        regularBlogs.forEach(blog => { if (blog.slug) pagesXml += urlEntry(`${baseUrl}/blog/${blog.slug}`, fmt(blog.updated_at), 'weekly', '0.7'); });
        registrars.forEach(r => { if (r.slug) pagesXml += urlEntry(`${baseUrl}/ipo-registrar-list/${r.slug}`, fmt(r.update_at), 'monthly', '0.7'); });
        consultants.forEach(c => { if (c.slug) pagesXml += urlEntry(`${baseUrl}/consultant/${c.slug}`, fmt(c.updated_at), 'monthly', '0.6'); });
        ipoDetails.forEach(ipo => { pagesXml += urlEntry(`${baseUrl}/all-ipos/${ipo.id}`, fmt(ipo.updated_at), 'weekly', '0.85'); });
        sectorPages.forEach(sector => { const s = toSlug(sector.name); if (s) pagesXml += urlEntry(`${baseUrl}/sector/${s}`, fmt(sector.updated_at), 'weekly', '0.75'); });
        merchantBankers.forEach(mb => { if (mb.slug) pagesXml += urlEntry(`${baseUrl}/merchant-banker/${mb.slug}`, fmt(mb.updated_at), 'monthly', '0.6'); });
        pagesXml += `</urlset>`;

        // ── 4. sitemap.xml — pure Sitemap Index pointing to all sub-sitemaps ──
        let mainXml = `<?xml version="1.0" encoding="UTF-8"?>
`;
        mainXml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
        mainXml += `  <sitemap>
    <loc>${escXml(baseUrl)}/ipo-blogs-sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
        mainXml += `  <sitemap>
    <loc>${escXml(baseUrl)}/article-blogs-sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
        mainXml += `  <sitemap>
    <loc>${escXml(baseUrl)}/news-sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
        mainXml += `  <sitemap>
    <loc>${escXml(baseUrl)}/pages-sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
        mainXml += `</sitemapindex>`;

        // ── Write all 5 files to server/public/ ────────────────
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

        fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), mainXml, 'utf-8');
        fs.writeFileSync(path.join(publicDir, 'ipo-blogs-sitemap.xml'), ipoBlogXml, 'utf-8');
        fs.writeFileSync(path.join(publicDir, 'article-blogs-sitemap.xml'), articleBlogXml, 'utf-8');
        fs.writeFileSync(path.join(publicDir, 'news-sitemap.xml'), newsXml, 'utf-8');
        fs.writeFileSync(path.join(publicDir, 'pages-sitemap.xml'), pagesXml, 'utf-8');

        console.log(`✅ Sitemaps generated: sitemap.xml (index), ipo-blogs-sitemap.xml (${seenIpoSlugs.size} URLs), article-blogs-sitemap.xml (${seenArticleSlugs.size} URLs), news-sitemap.xml (${newsArticles.length} URLs), pages-sitemap.xml`);
    } catch (err) {
        console.error('❌ generateAndSaveSitemaps error:', err.message);
    }
}

// ── Sitemap Index route — /sitemap.xml ──────────────────────
app.get('/sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'sitemap.xml');
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    }
    // File not yet generated — regen on the fly
    generateAndSaveSitemaps().then(() => {
        if (fs.existsSync(filePath)) {
            res.header('Content-Type', 'application/xml');
            res.send(fs.readFileSync(filePath, 'utf-8'));
        } else {
            res.status(500).send('Sitemap generation failed');
        }
    }).catch(() => res.status(500).send('Error generating sitemap'));
});

// ── IPO Blogs sub-sitemap route — /ipo-blogs-sitemap.xml ────
app.get('/ipo-blogs-sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'ipo-blogs-sitemap.xml');
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    }
    generateAndSaveSitemaps().then(() => {
        if (fs.existsSync(filePath)) {
            res.header('Content-Type', 'application/xml');
            res.send(fs.readFileSync(filePath, 'utf-8'));
        } else {
            res.status(500).send('IPO blogs sitemap generation failed');
        }
    }).catch(() => res.status(500).send('Error generating IPO blogs sitemap'));
});

// ── Article Blogs sub-sitemap route — /article-blogs-sitemap.xml ──
app.get('/article-blogs-sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'article-blogs-sitemap.xml');
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    }
    generateAndSaveSitemaps().then(() => {
        if (fs.existsSync(filePath)) {
            res.header('Content-Type', 'application/xml');
            res.send(fs.readFileSync(filePath, 'utf-8'));
        } else {
            res.status(500).send('Article blogs sitemap generation failed');
        }
    }).catch(() => res.status(500).send('Error generating article blogs sitemap'));
});

// ── News sub-sitemap route — /news-sitemap.xml ──────────────
app.get('/news-sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'news-sitemap.xml');
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    }
    generateAndSaveSitemaps().then(() => {
        if (fs.existsSync(filePath)) {
            res.header('Content-Type', 'application/xml');
            res.send(fs.readFileSync(filePath, 'utf-8'));
        } else {
            res.status(500).send('News sitemap generation failed');
        }
    }).catch(() => res.status(500).send('Error generating news sitemap'));
});

// ── Pages sub-sitemap route — /pages-sitemap.xml ──────────
app.get('/pages-sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'pages-sitemap.xml');
    if (fs.existsSync(filePath)) {
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    }
    generateAndSaveSitemaps().then(() => {
        if (fs.existsSync(filePath)) {
            res.header('Content-Type', 'application/xml');
            res.send(fs.readFileSync(filePath, 'utf-8'));
        } else {
            res.status(500).send('Pages sitemap generation failed');
        }
    }).catch(() => res.status(500).send('Error generating pages sitemap'));
});

// ── Manual sitemap regeneration API (admin use) ────────
app.get('/api/regen-sitemaps', async (req, res) => {
    if (req.query.key !== 'Indiaipo@123' && req.query.key !== 'indiaipo@123') {
        return res.status(403).send('Unauthorized');
    }
    await generateAndSaveSitemaps();
    res.json({ success: true, message: 'Sitemaps regenerated successfully' });
});


// ============================================================
// SSR META TAG INJECTION — Dynamic meta for crawlers/view-source
// ============================================================
// Yeh middleware sirf tab use hota hai jab Express production mein
// static files serve kar raha ho (dist folder). Crawlers aur
// view-source ke liye correct meta tags inject karta hai.
// ============================================================

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

const getServerImgSrc = (src) => {
    if (!src || src === "0" || src === 0 || src === "" || src === "null" || src === "undefined") return null;
    const s = String(src).trim();
    if (s.toLowerCase() === 'null') return null;
    if (s.startsWith('http') || s.startsWith('https') || s.startsWith('data:')) {
        return s;
    }
    if (s.startsWith('/static') || s.startsWith('/src/assets')) {
        return s;
    }
    let cleanPath = s;
    if (cleanPath.startsWith('/uploads')) {
        // leave as is
    } else if (cleanPath.startsWith('uploads/')) {
        cleanPath = `/${cleanPath}`;
    } else {
        cleanPath = `/uploads/${cleanPath}`;
    }
    return cleanPath;
};

const fetchHomeBanners = async () => {
    try {
        const query = `
            SELECT * 
            FROM hero_banners 
            WHERE is_active = 1 AND (page_path = '/' OR page_path = 'home' OR page_path IS NULL) 
            ORDER BY sort_order ASC
        `;
        const [rows] = await pool.execute(query);
        return rows;
    } catch (err) {
        console.error('❌ Error fetching home banners for SSR:', err);
        return [];
    }
};

const injectMetaTags = (html, meta) => {
    const escape = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const title = escape(meta.title);
    const description = escape(meta.description);
    const keywords = escape(meta.keywords || '');
    const ogImage = meta.ogImage || '';
    const canonical = meta.canonical || '';

    // Replace existing static tags in index.html
    let result = html;

    // Replace <title>...</title>
    result = result.replace(
        /<title>[^<]*<\/title>/,
        `<title data-rh="true">${title}</title>`
    );

    // Replace <meta name="description" .../>
    result = result.replace(
        /<meta[^>]*name=["']description["'][^>]*>/i,
        `<meta name="description" content="${description}" data-rh="true" />`
    );

    // Inject dynamic og/twitter/keywords tags right before </head>
    const dynamicTags = [
        keywords ? `<meta name="keywords" content="${keywords}" data-rh="true" />` : '',
        canonical ? `<link rel="canonical" href="${canonical}" data-rh="true" />` : '',
        `<meta property="og:title" content="${title}" data-rh="true" />`,
        `<meta property="og:description" content="${description}" data-rh="true" />`,
        `<meta property="og:type" content="article" data-rh="true" />`,
        ogImage ? `<meta property="og:image" content="${ogImage}" data-rh="true" />` : '',
        ogImage ? `<meta property="og:image:width" content="1200" data-rh="true" />` : '',
        ogImage ? `<meta property="og:image:height" content="630" data-rh="true" />` : '',
        canonical ? `<meta property="og:url" content="${canonical}" data-rh="true" />` : '',
        `<meta name="twitter:card" content="summary_large_image" data-rh="true" />`,
        `<meta name="twitter:title" content="${title}" data-rh="true" />`,
        `<meta name="twitter:description" content="${description}" data-rh="true" />`,
        ogImage ? `<meta name="twitter:image" content="${ogImage}" data-rh="true" />` : '',
        `<meta name="robots" content="${meta.noindex ? 'noindex' : 'index, follow'}" data-rh="true" />`,
    ];

    // Inject preconnect link for image domain
    dynamicTags.push(`<link rel="preconnect" href="https://api.indiaipoapp.indiaipo.in" crossorigin />`);

    if (meta.banners && meta.banners.length > 0) {
        const firstBanner = meta.banners[0];
        if (firstBanner) {
            const mobileImg = getServerImgSrc(firstBanner.mobile_image_url);
            const desktopImg = getServerImgSrc(firstBanner.image_url);
            if (mobileImg && desktopImg) {
                dynamicTags.push(`<link rel="preload" as="image" href="${mobileImg}" media="(max-width: 768px)" fetchpriority="high"  />`);
                dynamicTags.push(`<link rel="preload" as="image" href="${desktopImg}" media="(min-width: 769px)" fetchpriority="high" />`);
            } else if (desktopImg) {
                dynamicTags.push(`<link rel="preload" as="image" href="${desktopImg}" fetchpriority="high" />`);
            } else if (mobileImg) {
                dynamicTags.push(`<link rel="preload" as="image" href="${mobileImg}" fetchpriority="high"  />`);
            }
        }
    }

    if (meta.schema) {
        dynamicTags.push(`<script type="application/ld+json" data-rh="true">${JSON.stringify(meta.schema)}</script>`);
    }

    const dynamicTagsStr = dynamicTags.filter(Boolean).join('\n  ');

    // Remove existing og: and twitter: tags first to avoid duplicates (handles multiline tags)
    result = result.replace(/<meta[^>]*property=["']og:[^>]*>/gi, '');
    result = result.replace(/<meta[^>]*name=["']twitter:[^>]*>/gi, '');
    result = result.replace(/<meta[^>]*name=["']keywords["'][^>]*>/gi, '');
    result = result.replace(/<meta[^>]*name=["']robots["'][^>]*>/gi, '');
    result = result.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');

    // Inject before </head>
    result = result.replace('</head>', `  ${dynamicTagsStr}\n</head>`);

    // Inject window.__INITIAL_BANNERS__ right before </body> to reduce head blocking
    if (meta.banners) {
        const sanitizedBannersStr = JSON.stringify(meta.banners).replace(/</g, '\\u003c');
        const initialBannersScript = `<script id="initial-banners">window.__INITIAL_BANNERS__ = ${sanitizedBannersStr};</script>\n</body>`;
        result = result.replace('</body>', initialBannersScript);
    }

    return result;
};

// Helper: resolve image URL to absolute
const resolveImageUrl = (imgPath, siteUrl) => {
    if (!imgPath) return `${siteUrl}/favicon.png`;
    if (imgPath.startsWith('http')) return imgPath;
    // uploads/... paths
    const apiBase = process.env.API_URL || 'https://www.indiaipo.in';
    return `${apiBase}/${imgPath.replace(/^\//, '')}`;
};

// ==========================================================
// Global dist directory path — configured via DIST_PATH env
// Hostinger: set DIST_PATH=/home/.../public_html/ipo in .env.production
// Local dev: defaults to ../dist (relative to server folder)
// ==========================================================
// const distDir = process.env.DIST_PATH || path.join(__dirname, '..', 'dist');
const distDir = fs.existsSync(path.resolve(__dirname, '..', 'dist'))
    ? path.resolve(__dirname, '..', 'dist')
    : path.resolve(__dirname, 'dist');

console.log(`🔍 Checking distDir: ${distDir}`);
if (fs.existsSync(path.join(distDir, 'Annual_Report.pdf'))) {
    console.log(`✅ Annual_Report.pdf found in distDir`);
} else {
    console.error(`❌ Annual_Report.pdf NOT found in distDir`);
}
if (fs.existsSync(path.join(distDir, 'logo.png'))) {
    console.log(`✅ logo.png found in distDir`);
} else {
    console.error(`❌ logo.png NOT found in distDir`);
}

// IPO Blog SSR route — serves dist/index.html with injected meta tags
// Only active in production (when dist/index.html exists)
app.get('/ipo-blogs/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');

    // If dist/index.html doesn't exist, skip (dev mode — Vite handles it)
    if (!fs.existsSync(indexPath)) {
        return next();
    }

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        // Fetch blog data from DB
        const [rows] = await pool.query(
            'SELECT meta_title, description, keyword, image, title, new_slug, slug, faqs, created_at, category FROM admin_blogs WHERE new_slug = ? OR slug = ? LIMIT 1',
            [slug, slug]
        );

        let meta = {
            title: `India IPO — India's Leading IPO Consultancy Platform`,
            description: 'Expert IPO consultancy for SME IPO, Mainline IPO, FPO, Pre-IPO funding. SEBI registered advisory firm.',
            keywords: '',
            ogImage: '',
            canonical: `${siteUrl}/ipo-blogs/${slug}`,
        };

        if (rows.length > 0) {
            const blog = rows[0];
            const activeSlug = blog.new_slug || blog.slug;
            const rawTitle = blog.meta_title || blog.title || '';
            const rawDesc = blog.description || `Read details and updates about ${blog.title || 'this IPO'}`;

            // Strip basic HTML tags
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: blog.keyword || 'IPO, SME IPO, India IPO, GMP, stock market',
                ogImage: resolveImageUrl(blog.image, apiBase),
                canonical: `${siteUrl}/ipo-blogs/${activeSlug}`,
                noindex: activeSlug === 'hero-fincorp-limited-ipo' || slug === 'hero-fincorp-limited-ipo'
            };

            const articleSchema = {
                "@context": "https://schema.org",
                "@type": "Article",
                headline: meta.title,
                description: meta.description,
                image: [meta.ogImage || `${siteUrl}/favicon.png`],
                datePublished: (blog.created_at && !isNaN(new Date(blog.created_at).getTime())) ? new Date(blog.created_at).toISOString() : new Date().toISOString(),
                dateModified: new Date().toISOString(),
                author: { "@type": "Organization", name: "India IPO", url: siteUrl },
                publisher: {
                    "@type": "Organization",
                    name: "India IPO",
                    url: siteUrl,
                    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` }
                },
                mainEntityOfPage: { "@type": "WebPage", "@id": meta.canonical },
                keywords: meta.keywords,
                articleSection: (blog.category || "IPO").replace(/_/g, ' '),
                inLanguage: "en-IN"
            };

            let faqSchema = null;
            if (blog.faqs) {
                try {
                    const parsedFaqs = JSON.parse(blog.faqs);
                    if (Array.isArray(parsedFaqs) && parsedFaqs.length > 0) {
                        const validFaqs = parsedFaqs.filter(f => f && f.question && f.answer);
                        if (validFaqs.length > 0) {
                            faqSchema = {
                                "@context": "https://schema.org",
                                "@type": "FAQPage",
                                mainEntity: validFaqs.map(f => ({
                                    "@type": "Question",
                                    name: stripHtml(String(f.question)),
                                    acceptedAnswer: { "@type": "Answer", text: stripHtml(String(f.answer)) }
                                }))
                            };
                        }
                    }
                } catch (e) { }
            }

            meta.schema = faqSchema ? [articleSchema, faqSchema] : articleSchema;
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        const injectedHtml = injectMetaTags(html, meta);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
        res.send(injectedHtml);

    } catch (err) {
        console.error('❌ SSR meta injection error:', err.message);
        next(); // Fallback to static file serving
    }
});

// ============================================================
// SSR — Merchant Banker detail page (/merchant-banker/:slug)
// Handles BOTH SME and Mainboard bankers (same as frontend logic)
// ============================================================
app.get('/merchant-banker/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        // Query without mcat_id filter — handles both SME & Mainboard (same as frontend)
        const [rows] = await pool.query(
            `SELECT title, meta_title, meta_desc, meta_keywords, image, description, mcat_id
             FROM marchantbankers WHERE slug = ? LIMIT 1`,
            [slug]
        );

        let meta = {
            title: `Merchant Banker Profile | India IPO`,
            description: 'Find top SEBI-registered merchant bankers for SME and Mainboard IPO advisory, book running and listing support.',
            keywords: 'merchant banker, BRLM India, IPO advisory, BSE SME, NSE Emerge, mainboard IPO',
            ogImage: '',
            canonical: `${siteUrl}/merchant-banker/${slug}`,
        };

        if (rows.length > 0) {
            const b = rows[0];
            const isSME = String(b.mcat_id || '').includes('sme');
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();
            const rawTitle = b.meta_title || b.title || '';
            const rawDesc = b.meta_desc || b.description
                || `${b.title} — ${isSME ? 'SME' : 'Mainboard'} IPO Merchant Banker profile, IPO history, contact details.`;

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: b.meta_keywords
                    || (isSME
                        ? 'SME merchant banker, IPO advisory, BSE SME, NSE Emerge, BRLM India'
                        : 'mainboard merchant banker, BRLM India, NSE BSE IPO, mainline IPO lead manager'),
                ogImage: resolveImageUrl(b.image, apiBase),
                canonical: `${siteUrl}/merchant-banker/${slug}`,
            };
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR merchant-banker error:', err.message);
        next();
    }
});

// ============================================================
// SSR — IPO Registrar detail page (/ipo-registrar-list/:slug)
// Table: registrar — has: name, meta_title, meta_desc, meta_keywords, image, location
// ============================================================
app.get('/ipo-registrar-list/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        const [rows] = await pool.query(
            `SELECT name, slug, meta_title, meta_desc, meta_keywords, image, location, sme_ipo, mainboard_ipo
             FROM registrar WHERE slug = ? LIMIT 1`,
            [slug]
        );

        let meta = {
            title: `IPO Registrar | India IPO`,
            description: 'Find SEBI-registered IPO registrars for SME and Mainboard IPO listing services in India.',
            keywords: 'IPO registrar, SEBI registrar, India IPO registrar list, share transfer agent',
            ogImage: '',
            canonical: `${siteUrl}/ipo-registrar-list/${slug}`,
        };

        if (rows.length > 0) {
            const r = rows[0];
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

            const rawTitle = r.meta_title || r.name || '';
            const rawDesc = r.meta_desc
                || `${r.name} — SEBI-registered IPO Registrar${r.location ? ` based in ${r.location}` : ''}. Specializes in SME and Mainboard IPO registration and share transfer services in India.`;

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: r.meta_keywords || `${r.name}, IPO registrar${r.location ? ` ${r.location}` : ''}, SEBI registrar, share transfer agent, India IPO`,
                ogImage: r.image ? resolveImageUrl(r.image, apiBase) : '',
                canonical: `${siteUrl}/ipo-registrar-list/${r.slug || slug}`,
            };
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR /ipo-registrar-list/:slug error:', err.message);
        next();
    }
});

// ============================================================
// SSR — Consultant detail page (/consultant/:slug)
// Table: consultants — has: name, meta_title, meta_desc, meta_keywords, description, image_url
// ============================================================
app.get('/consultant/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        const [rows] = await pool.query(
            `SELECT name, meta_title, meta_desc, meta_keywords, description, image_url, slug, office_location, specialization, tags, cemail, cmobile, caddress, cweblink
             FROM consultants WHERE slug = ? LIMIT 1`,
            [slug]
        );

        let meta = {
            title: `IPO Consultant | India IPO`,
            description: 'Find expert SEBI-registered IPO consultants for SME and Mainboard IPO advisory services across India.',
            keywords: 'IPO consultant, SME IPO advisor, India IPO expert, SEBI registered consultant',
            ogImage: '',
            canonical: `${siteUrl}/consultant/${slug}`,
        };

        if (rows.length > 0) {
            const c = rows[0];
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();
            const rawTitle = c.meta_title || c.name || '';
            const rawDesc = c.meta_desc || c.description
                || `${c.name} — Expert IPO Consultant${c.office_location ? ` in ${c.office_location}` : ''}. ${c.specialization ? `Specialization: ${c.specialization}.` : ''} SME & Mainboard IPO advisory.`;

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: c.meta_keywords || `${c.name}, IPO consultant${c.office_location ? ` ${c.office_location}` : ''}, SME IPO advisor, India IPO expert`,
                ogImage: c.image_url ? resolveImageUrl(c.image_url, apiBase) : '',
                canonical: `${siteUrl}/consultant/${c.slug || slug}`,
            };

            meta.schema = {
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "name": c.name,
                "description": meta.description,
                "image": meta.ogImage || `${siteUrl}/favicon.png`,
                "url": meta.canonical,
                "telephone": c.cmobile || "+91-74283-37280",
                "email": c.cemail || "info@indiaipo.in",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": c.caddress || "",
                    "addressLocality": c.office_location || "India",
                    "addressCountry": "IN"
                },
                "geo": {
                    "@type": "GeoCoordinates",
                    "addressCountry": "IN"
                },
                "areaServed": {
                    "@type": "Country",
                    "name": "India"
                },
                "openingHoursSpecification": [
                    {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        "opens": "09:00",
                        "closes": "18:00"
                    }
                ],
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.9",
                    "reviewCount": "47",
                    "bestRating": "5"
                },
                "hasOfferCatalog": {
                    "@type": "OfferCatalog",
                    "name": "IPO Advisory Services",
                    "itemListElement": [
                        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SME IPO Advisory" } },
                        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mainboard IPO Listing" } },
                        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "DRHP Preparation" } },
                        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SEBI Compliance" } }
                    ]
                },
                "sameAs": c.cweblink ? [c.cweblink] : [],
                "priceRange": "₹₹₹",
                "currenciesAccepted": "INR",
                "paymentAccepted": "Cash, Bank Transfer, NEFT",
                "knowsAbout": ["IPO", "SME IPO", "SEBI", "BSE", "NSE", "Capital Markets", "DRHP"],
                "keywords": c.tags || "IPO advisor, IPO consultant, India IPO"
            };
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR /consultant/:slug error:', err.message);
        next();
    }
});

// Redirect old news URL pattern (/news/:slug) to new (/news/detail/:slug) for SEO compatibility
app.get('/news/:slug', (req, res, next) => {
    const { slug } = req.params;
    if (slug === 'detail') {
        return next();
    }
    const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
    return res.redirect(301, `${siteUrl}/news/detail/${slug}`);
});

// ============================================================
// SSR — News detail page (/news/detail/:slug)
// Table: api_news — has: title, slug, description, content, image, category, published_at
// ============================================================
app.get('/news/detail/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        // Slug or numeric ID fallback
        const isId = !isNaN(slug);
        const [rows] = await pool.query(
            isId
                ? 'SELECT title, slug, description, content, image, category, published_at FROM api_news WHERE id = ? LIMIT 1'
                : 'SELECT title, slug, description, content, image, category, published_at FROM api_news WHERE slug = ? LIMIT 1',
            [slug]
        );

        let meta = {
            title: `IPO & Market News | India IPO`,
            description: 'Stay updated with latest IPO news, market insights and financial updates from India IPO.',
            keywords: 'IPO news, India stock market news, SME IPO updates, market insights',
            ogImage: '',
            canonical: `${siteUrl}/news/detail/${slug}`,
        };

        if (rows.length > 0) {
            const n = rows[0];
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

            const rawTitle = n.title || '';
            // Use description if available, else first 320 chars of content
            const rawDesc = n.description
                || stripHtml(n.content || '').substring(0, 320)
                || `${rawTitle} — Read the latest update on India IPO.`;

            let finalTitle = stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : '');
            if (finalTitle.length > 55) finalTitle = finalTitle.substring(0, 52) + '...';

            let finalDesc = stripHtml(rawDesc);
            if (finalDesc.length > 140) finalDesc = finalDesc.substring(0, 137) + '...';

            meta = {
                title: finalTitle,
                description: finalDesc,
                keywords: `${n.category || 'IPO'}, IPO news, India IPO updates, ${rawTitle}`,
                ogImage: n.image ? resolveImageUrl(n.image, apiBase) : '',
                canonical: `${siteUrl}/news/detail/${n.slug || slug}`,
            };
            meta.schema = {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: meta.title,
                description: meta.description,
                image: [meta.ogImage || `${siteUrl}/favicon.png`],
                datePublished: (n.published_at && !isNaN(new Date(n.published_at).getTime())) ? new Date(n.published_at).toISOString() : new Date().toISOString(),
                dateModified: new Date().toISOString(),
                author: { "@type": "Organization", name: "India IPO", url: siteUrl },
                publisher: {
                    "@type": "Organization",
                    name: "India IPO",
                    url: siteUrl,
                    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` }
                },
                mainEntityOfPage: { "@type": "WebPage", "@id": meta.canonical },
                keywords: meta.keywords,
                articleSection: (n.category || "News").replace(/_/g, ' '),
                inLanguage: "en-IN"
            };
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR /news/:slug error:', err.message);
        next();
    }
});





app.use('/unsubscribe', unsubscribeRoutes);





// ============================================================
// SSR — Regular Blog detail page (/blog/:slug)
// Table: blog_slug — has: title, meta_title, excerpt, image_url, tags
// ============================================================
app.get('/blog/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        const [rows] = await pool.query(
            `SELECT title, meta_title, excerpt, image_url, tags, category, date as created_at
             FROM blog_slug WHERE new_slug = ? LIMIT 1`,
            [slug]
        );

        let meta = {
            title: `IPO Insights & Articles | India IPO`,
            description: 'Read expert IPO articles, market insights and investment tips from India IPO.',
            keywords: 'IPO blog, IPO articles, SME IPO insights, India stock market blog',
            ogImage: '',
            canonical: `${siteUrl}/blog/${slug}`,
        };

        if (rows.length > 0) {
            const b = rows[0];
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();
            const rawTitle = b.meta_title || b.title || '';
            const rawDesc = b.excerpt || `Read this article: ${b.title}`;

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: b.tags || b.category || 'IPO blog, India IPO, stock market articles',
                ogImage: b.image_url ? resolveImageUrl(b.image_url, apiBase) : '',
                canonical: `${siteUrl}/blog/${slug}`,
            };

            meta.schema = {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: meta.title,
                description: meta.description,
                image: [meta.ogImage || `${siteUrl}/favicon.png`],
                datePublished: (b.created_at && !isNaN(new Date(b.created_at).getTime())) ? new Date(b.created_at).toISOString() : new Date().toISOString(),
                dateModified: new Date().toISOString(),
                author: { "@type": "Organization", name: "India IPO", url: siteUrl },
                publisher: {
                    "@type": "Organization",
                    name: "India IPO",
                    url: siteUrl,
                    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` }
                },
                mainEntityOfPage: { "@type": "WebPage", "@id": meta.canonical },
                keywords: meta.keywords,
                articleSection: (b.category || "Blog").replace(/_/g, ' '),
                inLanguage: "en-IN"
            };
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR /blog/:slug error:', err.message);
        next();
    }
});

// ============================================================
// SSR — IPO Article Blog detail page (/blogs/:slug)
// Table: admin_blogs — same as /ipo-blogs but different URL prefix
// ============================================================
app.get('/blogs/:slug', async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();

    try {
        const { slug } = req.params;
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';

        // admin_blogs table — same as IPO blogs
        const [rows] = await pool.query(
            `SELECT meta_title, description, keyword, image, title, new_slug, slug, faqs, created_at, category
             FROM admin_blogs WHERE new_slug = ? OR slug = ? LIMIT 1`,
            [slug, slug]
        );

        let meta = {
            title: `IPO Blog | India IPO`,
            description: 'Expert IPO insights, GMP updates and market analysis from India IPO.',
            keywords: 'IPO blog, India IPO, GMP tracker, stock market articles',
            ogImage: '',
            canonical: `${siteUrl}/blogs/${slug}`,
        };

        if (rows.length > 0) {
            const b = rows[0];
            const activeSlug = b.new_slug || b.slug;
            const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();
            const rawTitle = b.meta_title || b.title || '';
            const rawDesc = b.description || `Read details and updates about ${b.title || 'this IPO'}`;

            meta = {
                title: stripHtml(rawTitle) + (rawTitle && !rawTitle.includes('India IPO') ? ' | India IPO' : ''),
                description: stripHtml(rawDesc).substring(0, 320),
                keywords: b.keyword || 'IPO, SME IPO, India IPO, GMP, stock market',
                ogImage: resolveImageUrl(b.image, apiBase),
                canonical: `${siteUrl}/blogs/${activeSlug}`,
            };

            const articleSchema = {
                "@context": "https://schema.org",
                "@type": "Article",
                headline: meta.title,
                description: meta.description,
                image: [meta.ogImage || `${siteUrl}/favicon.png`],
                datePublished: (b.created_at && !isNaN(new Date(b.created_at).getTime())) ? new Date(b.created_at).toISOString() : new Date().toISOString(),
                dateModified: new Date().toISOString(),
                author: { "@type": "Organization", name: "India IPO", url: siteUrl },
                publisher: {
                    "@type": "Organization",
                    name: "India IPO",
                    url: siteUrl,
                    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` }
                },
                mainEntityOfPage: { "@type": "WebPage", "@id": meta.canonical },
                keywords: meta.keywords,
                articleSection: (b.category || "IPO").replace(/_/g, ' '),
                inLanguage: "en-IN"
            };

            let faqSchema = null;
            if (b.faqs) {
                try {
                    const parsedFaqs = JSON.parse(b.faqs);
                    if (Array.isArray(parsedFaqs) && parsedFaqs.length > 0) {
                        const validFaqs = parsedFaqs.filter(f => f && f.question && f.answer);
                        if (validFaqs.length > 0) {
                            faqSchema = {
                                "@context": "https://schema.org",
                                "@type": "FAQPage",
                                mainEntity: validFaqs.map(f => ({
                                    "@type": "Question",
                                    name: stripHtml(String(f.question)),
                                    acceptedAnswer: { "@type": "Answer", text: stripHtml(String(f.answer)) }
                                }))
                            };
                        }
                    }
                } catch (e) { }
            }

            meta.schema = faqSchema ? [articleSchema, faqSchema] : articleSchema;
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ SSR /blogs/:slug error:', err.message);
        next();
    }
});


app.get(/.*/, async (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) return next();
    if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/uploads/') ||
        req.path.startsWith('/assets/') ||
        req.path.match(/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
    ) return next();

    try {
        const [rows] = await pool.query(
            'SELECT * FROM seo_pages WHERE page_path = ? LIMIT 1',
            [req.path]
        );

        if (rows.length === 0) return next(); // No custom SEO configured — serve normally

        const b = rows[0];
        const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
        const apiBase = process.env.API_URL || 'https://www.indiaipo.in';
        const normalizedPath = req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;

        const meta = {
            title: b.meta_title || `India IPO — India's Leading IPO Consultancy Platform`,
            description: b.meta_description || 'Expert IPO consultancy for SME IPO, Mainline IPO, FPO, Pre-IPO funding.',
            keywords: b.meta_keywords || 'IPO, India IPO, SME IPO, mainboard IPO',
            ogImage: b.og_image ? resolveImageUrl(b.og_image, apiBase) : '',
            canonical: b.canonical || `${siteUrl}${normalizedPath}`,
        };

        if (b.schema_json) {
            try {
                meta.schema = JSON.parse(b.schema_json);
            } catch (err) {
                console.error(`❌ Invalid JSON in schema_json for ${req.path}`);
            }
        }

        if (req.path === '/' || req.path === '/2' || req.path === '') {
            const homeSchemas = [
                {
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "url": siteUrl,
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": `${siteUrl}/search?q={search_term_string}`,
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Organization",
                    "name": "India IPO",
                    "url": siteUrl,
                    "logo": `${siteUrl}/logo.png`,
                    "sameAs": [
                        "https://www.facebook.com/01indiapo",
                        "https://x.com/india_ipo1",
                        "https://www.linkedin.com/company/india-ipo/",
                        "https://www.instagram.com/india_ipo1"
                    ],
                    "contactPoint": {
                        "@type": "ContactPoint",
                        "telephone": "+91-74283-37280",
                        "contactType": "customer service",
                        "email": "info@indiaipo.in",
                        "areaServed": "IN",
                        "availableLanguage": ["en", "hi"]
                    }
                },
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        { "@type": "Question", "name": "What is an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "An IPO is the process of raising capital from the public and listing the company on a stock exchange" } },
                        { "@type": "Question", "name": "How to plan an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "IPO planning includes readiness assessment, compliance, structuring the issue and aligning with market conditions." } },
                        { "@type": "Question", "name": "IPO Readiness", "acceptedAnswer": { "@type": "Answer", "text": "A company must have strong financials, governance and regulatory compliance before proceeding with an IPO." } },
                        { "@type": "Question", "name": "Is GMP a guaranteed listing price?", "acceptedAnswer": { "@type": "Answer", "text": "No, GMP is based on market demand in the grey market and can change before listing." } },
                        { "@type": "Question", "name": "How long does the IPO process take?", "acceptedAnswer": { "@type": "Answer", "text": "The IPO process usually takes a few months, depending on approvals and readiness." } },
                        { "@type": "Question", "name": "Can a company choose IPO timing?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, timing is planned based on market conditions, investor sentiment and business performance." } },
                        { "@type": "Question", "name": "What is an IPO and why should my company consider it?", "acceptedAnswer": { "@type": "Answer", "text": "An IPO (Initial Public Offering) is when a private company offers its shares to the public for the first time. It helps companies to raise substantial capital, develop credibility in the market, generate value to existing stakeholders and fuel growth. IPOs enable firms to expand, settle debts or enhance brand credibility." } },
                        { "@type": "Question", "name": "How do I know if my company is ready for an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "You're IPO-ready if you have: Consistent revenue and profitability, Scalable business operations, Strong governance and compliance systems, Clear use-of-proceeds plan. India IPO offers a free IPO readiness assessment to help you evaluate and prepare across financial, legal and strategic parameters." } },
                        { "@type": "Question", "name": "What are the key benefits and challenges of going public?", "acceptedAnswer": { "@type": "Answer", "text": "Benefits: Access to capital, Better brand image, Liquidity for shareholders, Strong market credibility. Challenges: Regulatory compliance, Public scrutiny, Cost of listing and disclosures, Managing investor expectations. India IPO helps you weigh these carefully and plan accordingly." } },
                        { "@type": "Question", "name": "How does India IPO assist in the IPO process?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO provides comprehensive advisory services, including: IPO readiness evaluation, Due diligence & documentation, Team building (merchant bankers, auditors, legal advisors), Regulatory filings and SEBI/NSE/BSE coordination, Branding and investor roadshows, Post-IPO compliance and governance support" } },
                        { "@type": "Question", "name": "What makes India IPO different from other IPO consultancy firms?", "acceptedAnswer": { "@type": "Answer", "text": "We combine deep regulatory expertise, founder-first guidance and practical execution. What sets us apart: End-to-end IPO lifecycle support, Access to funding & investor networks, Experience with startups, MSMEs & family-run businesses, Special asset-to-capital structuring (land, business, or legacy assets)" } },
                        { "@type": "Question", "name": "How long does the IPO process usually take with the India IPO?", "acceptedAnswer": { "@type": "Answer", "text": "An average SME IPO requires 4-6 months between the assessment and the listing, whereas a Mainboard IPO may require 6-12 months. The timing will depend on your readiness, approvals and market conditions. India IPO keeps you on track with end-to-end support." } }
                    ]
                }
            ];

            // If there's already a custom schema from DB, combine it
            if (meta.schema) {
                if (Array.isArray(meta.schema)) {
                    meta.schema = [...meta.schema, ...homeSchemas];
                } else {
                    meta.schema = [meta.schema, ...homeSchemas];
                }
            } else {
                meta.schema = homeSchemas;
            }
        } else if (req.path === '/contact') {
            const contactSchemas = [
                {
                    "@context": "https://schema.org",
                    "@type": "ContactPage",
                    "name": "Contact India IPO",
                    "description": "Get in touch with India IPO for IPO consultancy, advisory and capital market services.",
                    "url": `${siteUrl}/contact`,
                    "inLanguage": "en-IN",
                    "publisher": {
                        "@type": "Organization",
                        "name": "India IPO",
                        "url": siteUrl,
                        "telephone": "+91-74283-37280",
                        "email": "info@indiaipo.in",
                        "address": [
                            {
                                "@type": "PostalAddress",
                                "streetAddress": "808, 8th Floor, D-Mall, Netaji Subhash Place, Pitampura",
                                "addressLocality": "Delhi",
                                "postalCode": "110034",
                                "addressCountry": "IN"
                            },
                            {
                                "@type": "PostalAddress",
                                "streetAddress": "Office No. 601, Shagun Insignia, Ulwe, Sector-19",
                                "addressLocality": "Navi Mumbai",
                                "postalCode": "410206",
                                "addressCountry": "IN"
                            }
                        ]
                    }
                },
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        { "@type": "Question", "name": "What services does India IPO offer?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO provides end-to-end IPO advisory services including pre-IPO funding, DRHP preparation, regulatory compliance, merchant banking, and post-listing support for both SME and Mainboard IPOs." } },
                        { "@type": "Question", "name": "How can I apply for an IPO through India IPO?", "acceptedAnswer": { "@type": "Answer", "text": "You can apply through our platform by creating an account, linking your ASBA-enabled bank account or UPI ID, and submitting your application for any open IPO. Our team is available to guide you at every step." } },
                        { "@type": "Question", "name": "What is the typical response time for enquiries?", "acceptedAnswer": { "@type": "Answer", "text": "We typically respond to all queries within 24 business hours. For urgent matters, you can reach us on our WhatsApp or call our office directly during business hours." } },
                        { "@type": "Question", "name": "Does India IPO assist with SME IPOs?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, we have a dedicated SME IPO desk that assists companies in raising capital through NSE Emerge and BSE SME platforms, offering complete end-to-end support." } },
                        { "@type": "Question", "name": "Is India IPO registered with SEBI?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO works in collaboration with official merchant bankers and intermediaries. We ensure all project execution follows the regulatory guidelines strictly." } }
                    ]
                }
            ];

            if (meta.schema) {
                if (Array.isArray(meta.schema)) {
                    meta.schema = [...meta.schema, ...contactSchemas];
                } else {
                    meta.schema = [meta.schema, ...contactSchemas];
                }
            } else {
                meta.schema = contactSchemas;
            }
        }

        if (req.path === '/' || req.path === '/2' || req.path === '') {
            meta.banners = await fetchHomeBanners();
        }

        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.send(injectMetaTags(html, meta));

    } catch (err) {
        console.error('❌ Universal SSR error:', err.message);
        next();
    }
});

// distDir is already set above (from DIST_PATH env or default ../dist)
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
    // Catch-all: send index.html for all non-API routes (SPA routing) — Express 5 compatible
    app.get(/.*/, async (req, res, next) => {
        if (
            req.path.startsWith('/api/') ||
            req.path.startsWith('/uploads/') ||
            req.path.startsWith('/assets/') ||
            req.path.match(/\.(js|mjs|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
        ) {
            return next();
        }
        const indexPath = path.join(distDir, 'index.html');
        if (fs.existsSync(indexPath)) {
            const siteUrl = process.env.SITE_URL || 'https://www.indiaipo.in';
            const normalizedPath = req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
            const meta = {
                title: `India IPO — India's Leading IPO Consultancy Platform`,
                description: `Expert IPO consultancy for SME IPO, Mainline IPO, FPO, Pre-IPO funding. SEBI registered advisory firm.`,
                keywords: `IPO, SME IPO, Mainline IPO, FPO, Pre-IPO, Indian Stock Market, SEBI, IPO Consultancy`,
                ogImage: ``,
                canonical: `${siteUrl}${normalizedPath}`
            };

            if (req.path === '/' || req.path === '/2' || req.path === '') {
                meta.schema = [
                    {
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "url": siteUrl,
                        "potentialAction": {
                            "@type": "SearchAction",
                            "target": `${siteUrl}/search?q={search_term_string}`,
                            "query-input": "required name=search_term_string"
                        }
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": "India IPO",
                        "url": siteUrl,
                        "logo": `${siteUrl}/logo.png`,
                        "sameAs": [
                            "https://www.facebook.com/01indiapo",
                            "https://x.com/india_ipo1",
                            "https://www.linkedin.com/company/india-ipo/",
                            "https://www.instagram.com/india_ipo1"
                        ],
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "telephone": "+91-74283-37280",
                            "contactType": "customer service",
                            "email": "info@indiaipo.in",
                            "areaServed": "IN",
                            "availableLanguage": ["en", "hi"]
                        }
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": [
                            { "@type": "Question", "name": "What is an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "An IPO is the process of raising capital from the public and listing the company on a stock exchange" } },
                            { "@type": "Question", "name": "How to plan an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "IPO planning includes readiness assessment, compliance, structuring the issue and aligning with market conditions." } },
                            { "@type": "Question", "name": "IPO Readiness", "acceptedAnswer": { "@type": "Answer", "text": "A company must have strong financials, governance and regulatory compliance before proceeding with an IPO." } },
                            { "@type": "Question", "name": "Is GMP a guaranteed listing price?", "acceptedAnswer": { "@type": "Answer", "text": "No, GMP is based on market demand in the grey market and can change before listing." } },
                            { "@type": "Question", "name": "How long does the IPO process take?", "acceptedAnswer": { "@type": "Answer", "text": "The IPO process usually takes a few months, depending on approvals and readiness." } },
                            { "@type": "Question", "name": "Can a company choose IPO timing?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, timing is planned based on market conditions, investor sentiment and business performance." } },
                            { "@type": "Question", "name": "What is an IPO and why should my company consider it?", "acceptedAnswer": { "@type": "Answer", "text": "An IPO (Initial Public Offering) is when a private company offers its shares to the public for the first time. It helps companies to raise substantial capital, develop credibility in the market, generate value to existing stakeholders and fuel growth. IPOs enable firms to expand, settle debts or enhance brand credibility." } },
                            { "@type": "Question", "name": "How do I know if my company is ready for an IPO?", "acceptedAnswer": { "@type": "Answer", "text": "You're IPO-ready if you have: Consistent revenue and profitability, Scalable business operations, Strong governance and compliance systems, Clear use-of-proceeds plan. India IPO offers a free IPO readiness assessment to help you evaluate and prepare across financial, legal and strategic parameters." } },
                            { "@type": "Question", "name": "What are the key benefits and challenges of going public?", "acceptedAnswer": { "@type": "Answer", "text": "Benefits: Access to capital, Better brand image, Liquidity for shareholders, Strong market credibility. Challenges: Regulatory compliance, Public scrutiny, Cost of listing and disclosures, Managing investor expectations. India IPO helps you weigh these carefully and plan accordingly." } },
                            { "@type": "Question", "name": "How does India IPO assist in the IPO process?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO provides comprehensive advisory services, including: IPO readiness evaluation, Due diligence & documentation, Team building (merchant bankers, auditors, legal advisors), Regulatory filings and SEBI/NSE/BSE coordination, Branding and investor roadshows, Post-IPO compliance and governance support" } },
                            { "@type": "Question", "name": "What makes India IPO different from other IPO consultancy firms?", "acceptedAnswer": { "@type": "Answer", "text": "We combine deep regulatory expertise, founder-first guidance and practical execution. What sets us apart: End-to-end IPO lifecycle support, Access to funding & investor networks, Experience with startups, MSMEs & family-run businesses, Special asset-to-capital structuring (land, business, or legacy assets)" } },
                            { "@type": "Question", "name": "How long does the IPO process usually take with the India IPO?", "acceptedAnswer": { "@type": "Answer", "text": "An average SME IPO requires 4-6 months between the assessment and the listing, whereas a Mainboard IPO may require 6-12 months. The timing will depend on your readiness, approvals and market conditions. India IPO keeps you on track with end-to-end support." } }
                        ]
                    }
                ];
            } else if (req.path === '/contact') {
                meta.schema = [
                    {
                        "@context": "https://schema.org",
                        "@type": "ContactPage",
                        "name": "Contact India IPO",
                        "description": "Get in touch with India IPO for IPO consultancy, advisory and capital market services.",
                        "url": `${siteUrl}/contact`,
                        "inLanguage": "en-IN",
                        "publisher": {
                            "@type": "Organization",
                            "name": "India IPO",
                            "url": siteUrl,
                            "telephone": "+91-74283-37280",
                            "email": "info@indiaipo.in",
                            "address": [
                                {
                                    "@type": "PostalAddress",
                                    "streetAddress": "808, 8th Floor, D-Mall, Netaji Subhash Place, Pitampura",
                                    "addressLocality": "Delhi",
                                    "postalCode": "110034",
                                    "addressCountry": "IN"
                                },
                                {
                                    "@type": "PostalAddress",
                                    "streetAddress": "Office No. 601, Shagun Insignia, Ulwe, Sector-19",
                                    "addressLocality": "Navi Mumbai",
                                    "postalCode": "410206",
                                    "addressCountry": "IN"
                                }
                            ]
                        }
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": [
                            { "@type": "Question", "name": "What services does India IPO offer?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO provides end-to-end IPO advisory services including pre-IPO funding, DRHP preparation, regulatory compliance, merchant banking, and post-listing support for both SME and Mainboard IPOs." } },
                            { "@type": "Question", "name": "How can I apply for an IPO through India IPO?", "acceptedAnswer": { "@type": "Answer", "text": "You can apply through our platform by creating an account, linking your ASBA-enabled bank account or UPI ID, and submitting your application for any open IPO. Our team is available to guide you at every step." } },
                            { "@type": "Question", "name": "What is the typical response time for enquiries?", "acceptedAnswer": { "@type": "Answer", "text": "We typically respond to all queries within 24 business hours. For urgent matters, you can reach us on our WhatsApp or call our office directly during business hours." } },
                            { "@type": "Question", "name": "Does India IPO assist with SME IPOs?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, we have a dedicated SME IPO desk that assists companies in raising capital through NSE Emerge and BSE SME platforms, offering complete end-to-end support." } },
                            { "@type": "Question", "name": "Is India IPO registered with SEBI?", "acceptedAnswer": { "@type": "Answer", "text": "India IPO works in collaboration with official merchant bankers and intermediaries. We ensure all project execution follows the regulatory guidelines strictly." } }
                        ]
                    }
                ];
            }

            if (req.path === '/' || req.path === '/2' || req.path === '') {
                meta.banners = await fetchHomeBanners();
            }

            try {
                const html = fs.readFileSync(indexPath, 'utf-8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=300');
                res.send(injectMetaTags(html, meta));
            } catch (err) {
                console.error("❌ Send file error:", err.message);
                res.status(500).send("Error loading app");
            }
        } else {
            next();
        }
    });
    console.log(`✅ Serving React app from: ${distDir}`);
}

// Start server after DB init
initDB().then(async () => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
    // Generate sitemap files on startup (non-blocking)
    setTimeout(() => {
        generateAndSaveSitemaps().catch(err => console.error('❌ Startup sitemap error:', err.message));
    }, 3000); // Wait 3s for DB pool to be fully ready
});
