const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Users:", await prisma.user.findMany({ select: { id: true, name: true, roleId: true } }));
    console.log("Contacts:", await prisma.contact.findMany({ select: { id: true, name: true } }));
    console.log("Messages:", await prisma.message.findMany({ where: { body: { contains: 'Ram' } }, select: { id: true, body: true } }));
    await prisma.$disconnect();
}

run().catch(console.error);
