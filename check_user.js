const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const u = await prisma.user.findUnique({ where: { id: 14 } });
    console.log('User 14 Country:', u.country);
    
    const lead130 = await prisma.lead.findUnique({ where: { id: 130 }});
    console.log('Lead 130 Country:', lead130?.country);
    
    await prisma.$disconnect();
}
run();
