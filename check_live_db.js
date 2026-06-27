const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function checkLive() {
    try {
        console.log('Connecting to LIVE Railway Database...');
        const users = await prisma.user.findMany({
            select: { email: true, name: true, role: { select: { name: true } } }
        });
        console.log('✅ Connected! Users in LIVE DB:');
        console.table(users);
    } catch (err) {
        console.error('❌ Failed to connect to LIVE DB:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkLive();
