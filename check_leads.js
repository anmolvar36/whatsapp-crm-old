const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const leads = await prisma.lead.findMany({ where: { assignedTo: 14 } });
    console.log('Counselor 14 leads:', leads.map(x => ({ id: x.id, name: x.name, country: x.country, stage: x.stage })));
    await prisma.$disconnect();
}
run();
