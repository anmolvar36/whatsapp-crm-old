const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const country = 'GERMANY';
        const status = 'Enrolled';

        const where = {};
        if (country && country !== 'Global') {
            where.lead = { ...where.lead, country };
        }
        if (status && status !== 'All Stages') {
            where.lead = { ...where.lead, stage: status };
        }

        console.log('Query where:', JSON.stringify(where, null, 2));

        const notes = await prisma.counselorNote.findMany({
            where,
            include: {
                lead: { select: { name: true, country: true, stage: true } },
                author: { select: { name: true } }
            }
        });
        console.log('Notes found with filters:', notes.length);

        const allNotes = await prisma.counselorNote.findMany({
            include: { lead: true }
        });

        console.log('Total notes in DB:', allNotes.length);
        console.log('Notes with null leads:', allNotes.filter(n => !n.lead).length);

        // Also check leads in Germany
        const leadsInGermany = await prisma.lead.count({ where: { country: 'GERMANY' } });
        console.log('Leads in Germany:', leadsInGermany);

        const leadsEnrolled = await prisma.lead.count({ where: { stage: 'Enrolled' } });
        console.log('Leads Enrolled:', leadsEnrolled);

        // Let's also check country exact casing in DB
        const countries = await prisma.lead.groupBy({ by: ['country'], _count: { id: true } });
        console.log('Countries in DB:', countries);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
