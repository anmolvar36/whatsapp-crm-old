const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

async function testPermissions() {
    console.log("=== INTEGRATION PERMISSION CHECKS ===");

    // 1. Load users
    const roles = ['SUPPORT', 'COUNSELOR', 'TEAM_LEADER', 'MANAGER', 'ADMIN'];
    const users = {};
    for (const role of roles) {
        const email = role === 'SUPPORT' ? 'support@help.crm' :
                      role === 'COUNSELOR' ? 'counselor@sales.crm' :
                      role === 'TEAM_LEADER' ? 'leader@teams.crm' :
                      role === 'MANAGER' ? 'manager@analytics.crm' :
                      'admin@edu-corp.com';
        
        users[role] = await prisma.user.findFirst({
            where: { email },
            include: { role: true }
        });
        users[role].token = `Bearer ${jwt.sign({ id: users[role].id }, process.env.JWT_SECRET)}`;
    }

    // Create two leads: Lead 1 (assigned to Counselor), Lead 2 (assigned to another counselor or unassigned)
    const lead1 = await prisma.lead.create({
        data: { name: "Counselor Owned Lead", assignedTo: users['COUNSELOR'].id, stage: "New", team: "Alpha Squad" }
    });
    const lead2 = await prisma.lead.create({
        data: { name: "Other Lead", assignedTo: users['ADMIN'].id, stage: "New", team: "General" }
    });

    console.log(`Test Lead 1 (ID: ${lead1.id}) assigned to Counselor (ID: ${users['COUNSELOR'].id})`);
    console.log(`Test Lead 2 (ID: ${lead2.id}) assigned to Counselor 9999`);

    const results = {};

    // Helper to evaluate access
    const evaluate = (status) => status === 200 || status === 201 ? 'ALLOW' : 'DENY';

    // Test for each role
    for (const role of roles) {
        results[role] = {};
        const token = users[role].token;

        // 1. Create Follow-up on Owned Lead
        const createOwned = await request(app)
            .post(`/api/leads/${lead1.id}/followups`)
            .set('Authorization', token)
            .send({ scheduledTime: new Date(Date.now() + 86400000).toISOString(), notes: "Test scheduling" });
        results[role].createOwned = evaluate(createOwned.status);

        // 2. Create Follow-up on Unowned Lead
        const createUnowned = await request(app)
            .post(`/api/leads/${lead2.id}/followups`)
            .set('Authorization', token)
            .send({ scheduledTime: new Date(Date.now() + 86400000).toISOString(), notes: "Test scheduling" });
        results[role].createUnowned = evaluate(createUnowned.status);

        // Create a temporary follow-up on Lead 1 to test Completion/Rescheduling/Cancellation
        const tempFollowup = await prisma.leadFollowup.create({
            data: { leadId: lead1.id, counselorId: users['COUNSELOR'].id, scheduledTime: new Date(Date.now() + 86400000), status: 'Pending' }
        });

        // 3. Complete Follow-up
        const complete = await request(app)
            .put(`/api/leads/${lead1.id}/followups/${tempFollowup.id}/complete`)
            .set('Authorization', token)
            .send({ notes: "Completed task notes (long)" });
        results[role].complete = evaluate(complete.status);

        // 4. Reschedule Follow-up
        const reschedule = await request(app)
            .put(`/api/leads/${lead1.id}/followups/${tempFollowup.id}/reschedule`)
            .set('Authorization', token)
            .send({ scheduledTime: new Date(Date.now() + 172800000).toISOString(), notes: "Rescheduled task notes (long)" });
        results[role].reschedule = evaluate(reschedule.status);

        // 5. Cancel Follow-up
        const cancel = await request(app)
            .put(`/api/leads/${lead1.id}/followups/${tempFollowup.id}/cancel`)
            .set('Authorization', token)
            .send({ notes: "Cancelled task notes (long)" });
        results[role].cancel = evaluate(cancel.status);

        // 6. View Follow-up History
        const viewHistory = await request(app)
            .get(`/api/leads/${lead1.id}/followups`)
            .set('Authorization', token);
        results[role].viewHistory = evaluate(viewHistory.status);

        // Clean up temp followup
        await prisma.leadFollowup.delete({ where: { id: tempFollowup.id } }).catch(() => {});
    }

    console.log("\n=== ACCESS CONTROL MATRIX RESULTS ===");
    console.table(results);

    // Clean up leads
    await prisma.lead.deleteMany({ where: { id: { in: [lead1.id, lead2.id] } } });
}

testPermissions()
    .then(() => prisma.$disconnect())
    .catch(err => {
        console.error(err);
        prisma.$disconnect();
    });
