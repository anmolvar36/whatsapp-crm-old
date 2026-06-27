const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRawUnsafe("SHOW INDEX FROM rota WHERE Key_name = 'rota_publicId_key'");
        console.log('Index status found:', result.length > 0);
        if (result.length > 0) {
            console.log('Dropping duplicate index...');
            await prisma.$executeRawUnsafe("ALTER TABLE rota DROP INDEX rota_publicId_key");
            console.log('Index dropped.');
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
