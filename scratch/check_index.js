const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`SHOW INDEX FROM rota WHERE Key_name = 'rota_publicId_key'`;
        console.log('Index status:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error checking index:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
