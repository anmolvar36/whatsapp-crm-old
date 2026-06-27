const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- RECENT LEADS ---');
    const recentLeads = await prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            assignedUser: { select: { id: true, name: true, role: true, team: true, country: true } }
        }
    });
    console.dir(recentLeads, { depth: null });

    console.log('\n--- TEAM LEADER USERS ---');
    const tls = await prisma.user.findMany({
        where: { role: { name: 'TEAM_LEADER' } },
        include: { role: true }
    });
    console.dir(tls, { depth: null });

    await prisma.$disconnect();
}
run();
