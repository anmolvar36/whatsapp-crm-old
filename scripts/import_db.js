const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function importAll() {
    const filePath = path.join(__dirname, '../docs/crm-db-data.json');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('🌱 Synchronizing database from crm-db-data.json...');

    // Synchronize Users
    if (data.user) {
        console.log(`Syncing ${data.user.length} users...`);
        for (const u of data.user) {
            const { id, ...userData } = u;
            await prisma.user.upsert({
                where: { id: parseInt(id) },
                update: userData,
                create: { id: parseInt(id), ...userData }
            });
        }
    }

    // Synchronize Leads
    if (data.lead) {
        console.log(`Syncing ${data.lead.length} leads...`);
        for (const l of data.lead) {
            const { id, ...leadData } = l;
            await prisma.lead.upsert({
                where: { id: parseInt(id) },
                update: leadData,
                create: { id: parseInt(id), ...leadData }
            });
        }
    }

    // Synchronize AI Config
    if (data.aiConfig) {
        console.log(`Syncing AI Config...`);
        for (const config of data.aiConfig) {
            const { id, ...configData } = config;
            await prisma.aiConfig.upsert({
                where: { id: parseInt(id) },
                update: configData,
                create: { id: parseInt(id), ...configData }
            });
        }
    }

    // Add more tables as needed based on crm-db-data.json keys
    const tablesToSync = ['channel', 'routingRule', 'messageTemplate', 'subscription', 'integration', 'call'];
    for (const table of tablesToSync) {
        if (data[table]) {
            console.log(`Syncing ${data[table].length} items for ${table}...`);
            for (const item of data[table]) {
                const { id, ...itemData } = item;
                await prisma[table].upsert({
                    where: { id: parseInt(id) },
                    update: itemData,
                    create: { id: parseInt(id), ...itemData }
                });
            }
        }
    }

    console.log('\n✅ Database synchronization complete!');
    await prisma.$disconnect();
}

importAll().catch(e => {
    console.error(e);
    process.exit(1);
});
