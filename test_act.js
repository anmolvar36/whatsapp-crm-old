const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const act = await prisma.activity.findMany({ where: { leadId: 101 } });
    console.log("Activity (Lead 101):", act);

    const logs = await prisma.activityLog.findMany({ where: { details: { contains: '101' } } });
    console.log("Logs (101):", logs);

    await prisma.$disconnect();
}

run().catch(console.error);
