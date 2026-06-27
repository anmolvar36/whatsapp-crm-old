require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigate() {
    console.log("=== 1. Environment Variable Check ===");
    const envValue = process.env.DISABLE_LEAD_CONVERSION_VALIDATION;
    console.log("DISABLE_LEAD_CONVERSION_VALIDATION:", typeof envValue === 'undefined' ? 'undefined' : `"${envValue}"`);
    console.log("Evaluates to true?:", envValue === 'true');

    console.log("\n=== 2. Finding Recently Converted Leads ===");
    const convertedLeads = await prisma.lead.findMany({
        where: { stage: 'Converted' },
        orderBy: { updatedAt: 'desc' },
        take: 5
    });

    for (const lead of convertedLeads) {
        console.log(`\nLead ID: ${lead.id}, Name: ${lead.name}, Stage: ${lead.stage}`);
        
        const [messageCount, callCount, followupCount] = await Promise.all([
            prisma.message.count({
                where: { leadId: lead.id, sender: { not: 'lead' } }
            }),
            prisma.call.count({
                where: { leadId: lead.id, outcome: 'Connected' }
            }),
            prisma.leadFollowup.count({
                where: { leadId: lead.id, status: 'Completed' }
            })
        ]);

        console.log(`messageCount: ${messageCount}`);
        console.log(`callCount: ${callCount}`);
        console.log(`followupCount: ${followupCount}`);

        if (messageCount === 0 && callCount === 0 && followupCount === 0) {
            console.log("-> THIS LEAD BYPASSED VALIDATION!");
        } else {
            console.log("-> VALIDATION SATISFIED.");
            if (messageCount > 0) {
                const msgs = await prisma.message.findMany({ where: { leadId: lead.id, sender: { not: 'lead' } }});
                console.log("Messages:"); console.dir(msgs, {depth: null});
            }
            if (callCount > 0) {
                const calls = await prisma.call.findMany({ where: { leadId: lead.id, outcome: 'Connected' }});
                console.log("Calls:"); console.dir(calls, {depth: null});
            }
            if (followupCount > 0) {
                const followups = await prisma.leadFollowup.findMany({ where: { leadId: lead.id, status: 'Completed' }});
                console.log("Followups:"); console.dir(followups, {depth: null});
            }
        }
    }
    await prisma.$disconnect();
}

investigate().catch(console.error);
