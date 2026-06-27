const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing Prisma connection to database...');
        const users = await prisma.user.findMany({ take: 1 });
        console.log('✅ Prisma connected! Users found:', users.length);
    } catch (err) {
        console.error('❌ Prisma Connection Failed:');
        console.error(err.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
