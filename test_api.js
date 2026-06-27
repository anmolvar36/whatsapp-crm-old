require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const counselor = await prisma.user.findFirst({
        where: { role: { name: 'COUNSELOR' } }
    });
    console.log("Counselor Email:", counselor.email);

    // Let's also check lead 128
    const lead = await prisma.lead.findUnique({ where: { id: 128 } });
    console.log("Lead Stage before:", lead.stage);

    // Update via controller directly, mocking req and res
    const { updateStage } = require('./src/modules/users/counselor.controller');

    const req = {
        body: { leadId: 128, stage: 'Converted' },
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

    await updateStage(req, res, next);

    console.log("HTTP Status:", statusCalled);
    console.log("Response JSON:", jsonCalled);

    const leadAfter = await prisma.lead.findUnique({ where: { id: 128 } });
    console.log("Lead Stage after:", leadAfter.stage);

    await prisma.$disconnect();
}

run().catch(console.error);
