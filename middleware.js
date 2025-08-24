require('dotenv').config();
const { Pool } = require('pg');
// Create database connection for middleware
const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

console.log('DB Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const resolveTenant = async (req, res, next) => {
    try {
        const calledNumber =
  (req.body && (req.body.Called || req.body.To || req.body.to)) ||
  (req.body?.data?.payload?.to || req.body?.data?.payload?.to_number || req.body?.data?.payload?.to_phone_number);

        
        if (!calledNumber) {
            return res.status(400).json({ error: 'Missing called number' });
        }
        
        const result = await db.query(`
            SELECT o.*, os.*
            FROM organizations o
            LEFT JOIN org_settings os ON o.id = os.org_id
            WHERE o.id = 1
        `);
        
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        req.org = result.rows[0];
        console.log('Tenant resolved:', req.org.name);
        next();
    } catch (error) {
        console.error('Tenant resolution failed:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { resolveTenant };