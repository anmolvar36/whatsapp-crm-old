const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 30000,
};

// SSL only for production (Railway)
if (isProduction) {
    poolConfig.ssl = { rejectUnauthorized: false };
}

console.log(`\n📦 [DATABASE]: ${isProduction ? 'PRODUCTION (Railway)' : 'LOCAL (XAMPP)'} | ${poolConfig.host}:${poolConfig.port}\n`);

const pool = mysql.createPool(poolConfig);

pool.getConnection()
    .then(conn => {
        console.log('✅ Database connection established successfully');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        if (!isProduction) {
            console.error('   → Make sure XAMPP MySQL is STARTED (Green in Control Panel)');
        } else {
            console.error('   → Railway DB is only accessible when backend is deployed ON Railway');
        }
    });

module.exports = pool;
