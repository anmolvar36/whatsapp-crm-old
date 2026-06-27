const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportAll(targetPath = null) {
    const data = {};

    // Ignore internal properties
    const modelNames = Object.keys(prisma).filter(k =>
        !k.startsWith('_') &&
        !k.startsWith('$') &&
        typeof prisma[k].findMany === 'function'
    );

    for (const modelName of modelNames) {
        try {
            console.log(`Exporting table: ${modelName}...`);
            data[modelName] = await prisma[modelName].findMany();
        } catch (e) {
            console.error(`Error exporting ${modelName}:`, e.message);
        }
    }

    // Determine target path and ensure directory exists
    const filePath = targetPath || path.join(__dirname, '../docs', 'crm-db-data.json');
    const targetDir = path.dirname(filePath);
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`\nSuccessfully exported database to ${filePath}`);
    
    return filePath;
}

module.exports = { exportAll };

if (require.main === module) {
    exportAll().catch(e => {
        console.error(e);
        process.exit(1);
    }).finally(async () => {
        await prisma.$disconnect();
    });
}
