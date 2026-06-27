const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const counselors = await prisma.user.findMany({
        where: {
            role: { name: 'COUNSELOR' },
            status: 'Active'
        },
        include: { role: true }
    });
    console.log('Active Counselors in DB:', counselors.map(c => ({ id: c.id, name: c.name, status: c.status })));
    await prisma.$disconnect();
}
run();
