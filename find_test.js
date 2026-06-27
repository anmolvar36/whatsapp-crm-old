const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const leads = await prisma.lead.findMany({ where: { name: { contains: 'test' } } });
    console.log(leads);

    const allLeads = await prisma.lead.findMany();
    const ts = allLeads.filter(l => l.name.toUpperCase() === 'TEST STUDENT');
    console.log("TEST STUDENT exactly:", ts);

    await prisma.$disconnect();
}

run().catch(console.error);
