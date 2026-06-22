import express from 'express';
import pool from '../db.mjs';

const router = express.Router();

const safeCount = (tableName, where = '') =>
    pool.query(`SELECT COUNT(*) as count FROM ${tableName}${where ? ' WHERE ' + where : ''}`)
        .then(([rows]) => rows[0].count)
        .catch(() => 0);

// GET /api/dashboard/stats - Returns all counts for the admin dashboard
router.get('/stats', async (req, res) => {
    try {
        const [
            totalIPOs,
            activeIPOs,
            upcomingIPOs,
            totalBlogs,
            totalReports,
            totalUsers,
            totalLeads,
            unreadLeads,
            totalSubscriptions,
            totalConsultantEnquiries,
            unreadConsultantEnquiries,
            totalMerchantEnquiries,
            unreadMerchantEnquiries,
            totalInvestorEnquiries,
            totalCareerApplications,
            totalAdminBlogs,
        ] = await Promise.all([
            safeCount('ipo_lists'),
            safeCount('ipo_lists', 'status = "Open"'),
            safeCount('ipo_lists', 'upcoming = 1'),
            safeCount('blogs'),
            safeCount('report_items'),
            safeCount('users'),
            safeCount("visitors", "form_type = 'contact_us'"),
            safeCount("visitors", "form_type = 'contact_us' AND is_read = 0"),
            safeCount("visitors", "form_type = 'subscription' AND is_subscribed = 1"),
            safeCount("visitors", "form_type = 'consultant_enquiry'"),
            safeCount("visitors", "form_type = 'consultant_enquiry' AND is_read = 0"),
            safeCount('merchant_contact_enquiries'),
            safeCount('merchant_contact_enquiries', 'is_read = 0'),
            safeCount('investor'),
            safeCount('career'),
            safeCount('admin_blogs'),
        ]);

        // Monthly leads trend (last 6 months)
        const leadsTrend = await pool.query(`
            SELECT DATE_FORMAT(created_at, '%b %Y') as month, COUNT(*) as count
            FROM visitors
            WHERE form_type = 'contact_us' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
            ORDER BY MIN(created_at) ASC
        `).then(([rows]) => rows).catch(() => []);

        // Monthly subscriptions trend (last 6 months)
        const subscriptionsTrend = await pool.query(`
            SELECT DATE_FORMAT(created_at, '%b %Y') as month, COUNT(*) as count
            FROM visitors
            WHERE form_type = 'subscription' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
            ORDER BY MIN(created_at) ASC
        `).then(([rows]) => rows).catch(() => []);

        // Enquiry breakdown
        const enquiryBreakdown = await pool.query(`
            SELECT 'Consultant' as type, COUNT(*) as count FROM visitors WHERE form_type = 'consultant_enquiry'
            UNION ALL
            SELECT 'Merchant' as type, COUNT(*) as count FROM merchant_contact_enquiries
            UNION ALL
            SELECT 'Investor' as type, COUNT(*) as count FROM investor
            UNION ALL
            SELECT 'Leads' as type, COUNT(*) as count FROM visitors WHERE form_type = 'contact_us'
        `).then(([rows]) => rows).catch(() => []);

        // Recent activity - mixed from visitors and other tables
        const recentLeads = await pool.query(
            `SELECT 'lead' as type, name, email, created_at FROM visitors WHERE form_type = 'contact_us' ORDER BY created_at DESC LIMIT 3`
        ).then(([rows]) => rows).catch(() => []);

        const recentConsultant = await pool.query(
            `SELECT 'consultant_enquiry' as type, name, email, created_at FROM visitors WHERE form_type = 'consultant_enquiry' ORDER BY created_at DESC LIMIT 2`
        ).then(([rows]) => rows).catch(() => []);

        const recentMerchant = await pool.query(
            `SELECT 'merchant_enquiry' as type, name, email, created_at FROM merchant_contact_enquiries ORDER BY created_at DESC LIMIT 2`
        ).then(([rows]) => rows).catch(() => []);

        const recentInvestor = await pool.query(
            `SELECT 'investor' as type, name, email, created_at FROM investor ORDER BY created_at DESC LIMIT 3`
        ).then(([rows]) => rows).catch(() => []);

        const recentCareer = await pool.query(
            `SELECT 'career' as type, CONCAT(name, ' ', COALESCE(last_name,'')) as name, email, created_at FROM career ORDER BY created_at DESC LIMIT 2`
        ).then(([rows]) => rows).catch(() => []);

        // Merge and sort all recent activity by date
        const recentActivity = [
            ...recentLeads,
            ...recentConsultant,
            ...recentMerchant,
            ...recentInvestor,
            ...recentCareer,
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

        res.json({
            totalIPOs,
            activeIPOs,
            upcomingIPOs,
            totalBlogs,
            totalReports,
            totalUsers,
            totalLeads,
            unreadLeads,
            totalSubscriptions,
            totalConsultantEnquiries,
            unreadConsultantEnquiries,
            totalMerchantEnquiries,
            unreadMerchantEnquiries,
            totalInvestorEnquiries,
            totalCareerApplications,
            totalAdminBlogs,
            leadsTrend,
            subscriptionsTrend,
            enquiryBreakdown,
            recentActivity,
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
