const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roles = await prisma.role.findMany();
    console.log('Current roles:', roles);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
