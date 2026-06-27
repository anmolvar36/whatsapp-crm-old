const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const notes = await prisma.counselorNote.findMany({
            include: { lead: true, author: true }
        });

        console.log('Total notes:', notes.length);
        const nullLeads = notes.filter(n => !n.lead);
        console.log('Notes with null leads:', nullLeads.length);
        const nullAuthors = notes.filter(n => !n.author);
        console.log('Notes with null authors:', nullAuthors.length);

        if (nullAuthors.length > 0 || nullLeads.length > 0) {
            console.log('FOUND OFFENDING RECORDS THAT WILL CRASH CONTROLLER');
        } else {
            console.log('All relations are intact');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
