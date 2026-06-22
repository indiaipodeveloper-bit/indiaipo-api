import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'Indiaipo@123';

export const authenticateAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization denied, no token provided' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if role is admin or super_admin
        const userRole = (decoded.role || '').toLowerCase();
        if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'super admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Token is invalid or expired' });
    }
};
