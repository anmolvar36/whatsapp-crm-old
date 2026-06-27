const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocalUsers() {
    try {
        console.log('Checking LOCAL database users...');
        const users = await prisma.user.findMany({
            select: { email: true, name: true }
        });
        console.log('✅ Users found in LOCAL DB:');
        console.table(users);
        if (users.length === 0) {
            console.log('❌ NO USERS FOUND! Aapko database seed karna padega.');
        }
    } catch (err) {
        console.error('❌ Error reading local DB:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkLocalUsers();
