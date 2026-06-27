require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const counselor = await prisma.user.findFirst({
        where: { role: { name: 'COUNSELOR' } }
    });

    // Let's check lead 128
    const lead = await prisma.lead.findUnique({ where: { id: 128 } });

    // Update via controller directly
    const { updateLead } = require('./src/modules/leads/lead.controller');

    const req = {
        params: { id: 128 },
        body: { stage: 'Converted' },
        user: { id: counselor.id, roleName: 'COUNSELOR', role: { name: 'COUNSELOR' } }
    };

    let statusCalled = null;
    let jsonCalled = null;

    const res = {
        status: (s) => {
            statusCalled = s;
            return res;
        },
        json: (j) => {
            jsonCalled = j;
            return res;
        }
    };

    const next = (err) => {
        console.log("Next called with:", err);
    };

    await updateLead(req, res, next);

    console.log("HTTP Status:", statusCalled);
    console.log("Response JSON:", jsonCalled);

    await prisma.$disconnect();
}

run().catch(console.error);
