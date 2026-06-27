const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const rules = await prisma.routingRule.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log('Rules grabbed by backend query:', rules.length);
        console.log(rules);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
