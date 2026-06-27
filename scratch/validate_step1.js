const mysql = require('mysql2/promise');
require('dotenv').config();

async function validate() {
    console.log("=== STEP 1 SCHEMA VALIDATION ===");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crm_db',
        port: parseInt(process.env.DB_PORT) || 3306,
    });

    try {
        // Query columns of lead_followups
        const [columns] = await connection.query("SHOW COLUMNS FROM lead_followups");
        console.log("Columns in lead_followups:");
        console.table(columns.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

        // Check for specific columns
        const fields = columns.map(c => c.Field);
        const hasNotes = fields.includes('notes');
        const hasCompletedAt = fields.includes('completedAt');
        const hasRescheduledFromId = fields.includes('rescheduledFromId');
        
        const statusCol = columns.find(c => c.Field === 'status');
        const isEnumUpdated = statusCol && statusCol.Type.includes('Completed') && !statusCol.Type.includes('Met');

        if (hasNotes && hasCompletedAt && hasRescheduledFromId && isEnumUpdated) {
            console.log("\n[SUCCESS] Step 1 Schema Validation PASSED!");
        } else {
            console.log("\n[FAIL] Schema check failed details:");
            console.log(`- hasNotes: ${hasNotes}`);
            console.log(`- hasCompletedAt: ${hasCompletedAt}`);
            console.log(`- hasRescheduledFromId: ${hasRescheduledFromId}`);
            console.log(`- isEnumUpdated (Completed present, Met absent): ${isEnumUpdated} (${statusCol?.Type})`);
        }
    } catch (err) {
        console.error("Validation error:", err.message);
    } finally {
        await connection.end();
    }
}

validate();
