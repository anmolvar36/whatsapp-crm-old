const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugConnection() {
    const configs = [
        { name: 'Standard (No SSL)', ssl: false },
        { name: 'SSL (No Verify)', ssl: { rejectUnauthorized: false } }
    ];

    for (const config of configs) {
        console.log(`\n--- Testing: ${config.name} ---`);
        try {
            const conn = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: parseInt(process.env.DB_PORT),
                ssl: config.ssl,
                connectTimeout: 10000
            });
            console.log(`✅ Success with ${config.name}!`);
            await conn.end();
        } catch (err) {
            console.error(`❌ Failed with ${config.name}:`, err.message);
            console.error(`Error Code: ${err.code}`);
        }
    }
}

debugConnection();
