const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

async function runTests() {
    console.log("=== BEGINNING INTEGRATION TESTS FOR PHASE-2 BACKEND ===");
    
    // 1. Get users from DB
    const counselorUser = await prisma.user.findFirst({
        where: { email: 'counselor@sales.crm' },
        include: { role: true }
    });
    const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@edu-corp.com' },
        include: { role: true }
    });

    if (!counselorUser || !adminUser) {
        console.error("Required test users not found in DB! Run seeds first.");
        process.exit(1);
    }

    // 2. Generate tokens
    const counselorToken = `Bearer ${jwt.sign({ id: counselorUser.id }, process.env.JWT_SECRET)}`;
    const adminToken = `Bearer ${jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET)}`;

    console.log(`Authenticated as Counselor (ID: ${counselorUser.id}) and Admin (ID: ${adminUser.id})`);

    // Clean up any test logs or leads first if needed, but we'll just create new ones
    console.log("\n--- TEST 1: Creation of a Lead & Blocking Conversion without Interaction ---");
    
    // Create lead
    const createLeadRes = await request(app)
        .post('/api/leads')
        .set('Authorization', adminToken)
        .send({
            name: "Phase2 Test Lead",
            country: "India",
            phone: "+919999999999",
            email: "phase2test@crm.com",
            program: "Data Science",
            stage: "New",
            source: "Website"
        });

    if (!createLeadRes.body.success) {
        console.error("Lead creation failed:", createLeadRes.body);
        process.exit(1);
    }

    const leadId = createLeadRes.body.data.id;
    console.log(`Lead created successfully with ID: ${leadId}`);

    // Assign to counselor
    await prisma.lead.update({
        where: { id: leadId },
        data: { assignedTo: counselorUser.id }
    });
    console.log(`Assigned lead to Counselor ID: ${counselorUser.id}`);

    // Try to convert
    const convertFailRes = await request(app)
        .put(`/api/leads/${leadId}`)
        .set('Authorization', counselorToken)
        .send({ stage: "Converted" });

    console.log(`Conversion attempt without interaction (Status Code): ${convertFailRes.status}`);
    console.log(`Response message: ${JSON.stringify(convertFailRes.body)}`);

    if (convertFailRes.status === 403) {
        console.log("✅ PASS: Direct conversion blocked as expected!");
    } else {
        console.error("❌ FAIL: Direct conversion should have returned 403!");
    }

    console.log("\n--- TEST 2: Follow-up Creation, Completion, & Successful Conversion ---");

    // Create follow-up
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const createFollowupRes = await request(app)
        .post(`/api/leads/${leadId}/followups`)
        .set('Authorization', counselorToken)
        .send({
            scheduledTime: tomorrow.toISOString(),
            notes: "Initial scheduling note"
        });

    console.log(`Create Follow-up (Status Code): ${createFollowupRes.status}`);
    if (createFollowupRes.body.success) {
        console.log("✅ PASS: Follow-up created successfully.");
    } else {
        console.error("❌ FAIL: Could not create follow-up:", createFollowupRes.body);
    }

    const followupId = createFollowupRes.body.data.id;

    // Complete follow-up
    const completeFollowupRes = await request(app)
        .put(`/api/leads/${leadId}/followups/${followupId}/complete`)
        .set('Authorization', counselorToken)
        .send({
            notes: "Spoke with lead, details logged here (long notes)."
        });

    console.log(`Complete Follow-up (Status Code): ${completeFollowupRes.status}`);
    if (completeFollowupRes.body.success) {
        console.log("✅ PASS: Follow-up completed successfully.");
    } else {
        console.error("❌ FAIL: Could not complete follow-up:", completeFollowupRes.body);
    }

    // Try to convert now that there is a completed follow-up interaction
    const convertSuccessRes = await request(app)
        .put(`/api/leads/${leadId}`)
        .set('Authorization', counselorToken)
        .send({ stage: "Converted" });

    console.log(`Conversion attempt after interaction (Status Code): ${convertSuccessRes.status}`);
    if (convertSuccessRes.body.success) {
        console.log("✅ PASS: Conversion succeeded with interaction history!");
    } else {
        console.error("❌ FAIL: Conversion should have succeeded:", convertSuccessRes.body);
    }

    console.log("\n--- TEST 3: Reschedule Chain & Cancellation ---");

    // Create a new lead for rescheduling test
    const lead2Res = await request(app)
        .post('/api/leads')
        .set('Authorization', adminToken)
        .send({
            name: "Phase2 Reschedule Lead",
            country: "India",
            phone: "+918888888888",
            email: "reschedule@crm.com",
            stage: "New"
        });
    const lead2Id = lead2Res.body.data.id;

    // Assign to counselor
    await prisma.lead.update({ where: { id: lead2Id }, data: { assignedTo: counselorUser.id } });

    // Schedule initial follow-up
    const initFollowupRes = await request(app)
        .post(`/api/leads/${lead2Id}/followups`)
        .set('Authorization', counselorToken)
        .send({
            scheduledTime: tomorrow.toISOString(),
            notes: "Initial scheduled task"
        });
    const fId1 = initFollowupRes.body.data.id;

    // Reschedule
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const rescheduleRes = await request(app)
        .put(`/api/leads/${lead2Id}/followups/${fId1}/reschedule`)
        .set('Authorization', counselorToken)
        .send({
            scheduledTime: nextWeek.toISOString(),
            notes: "Customer asked to call back next week"
        });

    console.log(`Reschedule Follow-up (Status Code): ${rescheduleRes.status}`);
    const fId2 = rescheduleRes.body.data.id;
    console.log(`New Follow-up ID created: ${fId2}`);

    // Verify rescheduledFromId link
    const fetchedNewFollowup = await prisma.leadFollowup.findUnique({
        where: { id: fId2 }
    });

    if (fetchedNewFollowup.rescheduledFromId === fId1) {
        console.log(`✅ PASS: Reschedule chain correctly linked ${fId2} -> rescheduledFromId -> ${fId1}`);
    } else {
        console.error("❌ FAIL: Link incorrect!");
    }

    // Cancel the rescheduled follow-up
    const cancelRes = await request(app)
        .put(`/api/leads/${lead2Id}/followups/${fId2}/cancel`)
        .set('Authorization', counselorToken)
        .send({
            notes: "Customer is no longer interested"
        });

    console.log(`Cancel Follow-up (Status Code): ${cancelRes.status}`);
    if (cancelRes.body.success) {
        console.log("✅ PASS: Follow-up cancelled successfully.");
    } else {
        console.error("❌ FAIL: Cancel failed!");
    }

    console.log("\n--- TEST 4: Manager Override Case ---");

    // Create a new lead for override test
    const lead3Res = await request(app)
        .post('/api/leads')
        .set('Authorization', adminToken)
        .send({
            name: "Phase2 Override Lead",
            country: "India",
            phone: "+917777777777",
            email: "override@crm.com",
            stage: "New"
        });
    const lead3Id = lead3Res.body.data.id;

    // Try to convert as Counselor with override payload (should fail since Counselor role is not allowed to override)
    const counselorOverrideRes = await request(app)
        .put(`/api/leads/${lead3Id}`)
        .set('Authorization', counselorToken)
        .send({ stage: "Converted", managerOverride: true });

    console.log(`Counselor Override Attempt (Status Code): ${counselorOverrideRes.status}`);
    if (counselorOverrideRes.status === 403) {
        console.log("✅ PASS: Counselor block on manager override verified.");
    } else {
        console.error("❌ FAIL: Counselor should not be allowed to override!");
    }

    // Try to convert as Admin with override payload (should succeed)
    const adminOverrideRes = await request(app)
        .put(`/api/leads/${lead3Id}`)
        .set('Authorization', adminToken)
        .send({ stage: "Converted", managerOverride: true });

    console.log(`Admin Override Attempt (Status Code): ${adminOverrideRes.status}`);
    if (adminOverrideRes.body.success) {
        console.log("✅ PASS: Admin manager override verified.");
    } else {
        console.error("❌ FAIL: Admin manager override failed:", adminOverrideRes.body);
    }

    console.log("\n--- TEST 5: Verify Database Activity Logs ---");
    const activityLogs = await prisma.activityLog.findMany({
        where: {
            action: {
                in: ['FOLLOWUP_CREATED', 'FOLLOWUP_COMPLETED', 'FOLLOWUP_CANCELLED', 'FOLLOWUP_RESCHEDULED']
            }
        },
        orderBy: { timestamp: 'desc' },
        take: 5
    });

    console.log("Activity logs created during tests:");
    console.table(activityLogs.map(l => ({ Action: l.action, Details: l.details, Module: l.module })));

    // Clean up test data
    await prisma.leadFollowup.deleteMany({ where: { leadId: { in: [leadId, lead2Id, lead3Id] } } });
    await prisma.lead.deleteMany({ where: { id: { in: [leadId, lead2Id, lead3Id] } } });
    console.log("\n✅ Integration tests cleanup completed.");
}

runTests()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error("Critical test error:", err);
        prisma.$disconnect();
    });
