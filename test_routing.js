const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const rules = await prisma.routingRule.findMany();
        console.log('Total routing rules:', rules.length);
        console.log(rules);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
