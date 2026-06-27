const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const leadController = require('../src/modules/leads/lead.controller');
const supportController = require('../src/modules/users/support.controller');
const counselorController = require('../src/modules/users/counselor.controller');

async function testAll() {
    try {
        console.log("=== PHASE 1 EVIDENCE-BASED VALIDATION RUN ===\n");

        // 1. Resolve Users
        const supportUser = await prisma.user.findFirst({
            where: { email: 'support@help.crm' },
            include: { role: true }
        });
        const counselorUser = await prisma.user.findFirst({
            where: { email: 'counselor@sales.crm' },
            include: { role: true }
        });
        const teamLeader = await prisma.user.findFirst({
            where: { email: 'leader@teams.crm' },
            include: { role: true }
        });

        console.log(`Resolved Support User: ${supportUser.name} (ID: ${supportUser.id}, Role: ${supportUser.role.name})`);
        console.log(`Resolved Counselor User: ${counselorUser.name} (ID: ${counselorUser.id}, Role: ${counselorUser.role.name})`);
        console.log(`Resolved Team Leader User: ${teamLeader.name} (ID: ${teamLeader.id}, Role: ${teamLeader.role.name})`);

        // Helper mock response
        const mockRes = () => {
            const res = {};
            res.status = (code) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data) => {
                res.jsonData = data;
                return res;
            };
            res.send = (data) => {
                res.sendData = data;
                return res;
            };
            return res;
        };

        // --- TEST 1: Support Create Lead via support.controller.js ---
        console.log("\n[TEST 1] Support creating a new lead via /api/support/leads...");
        const reqCreate = {
            user: {
                id: supportUser.id,
                name: supportUser.name,
                roleName: supportUser.role.name,
                role: supportUser.role,
                team: supportUser.team
            },
            body: {
                name: "Support Test Lead",
                phone: "+919999999999",
                email: "support.test@crm.com",
                program: "Business Administration",
                source: "Facebook"
            }
        };

        const resCreate = mockRes();
        await supportController.createLead(reqCreate, resCreate, (err) => {
            if (err) console.error("Error in supportController.createLead:", err);
        });

        console.log("Response Status:", resCreate.statusCode || 201);
        console.log("Response JSON:", JSON.stringify(resCreate.jsonData, null, 2));

        const createdLeadId = resCreate.jsonData.id;

        // Verify ActivityLog was created
        const createActivityLog = await prisma.activityLog.findFirst({
            where: {
                userId: supportUser.id,
                action: 'LEAD_CREATED'
            },
            orderBy: { timestamp: 'desc' }
        });
        console.log("\nCreated ActivityLog Row (Verification):");
        console.log(JSON.stringify(createActivityLog, null, 2));


        // --- TEST 2: Support Assign Lead via support.controller.js ---
        console.log("\n[TEST 2] Support Agent assigning lead to Counselor via /api/support/assign...");
        const reqAssign1 = {
            user: {
                id: supportUser.id,
                name: supportUser.name,
                roleName: supportUser.role.name,
                role: supportUser.role,
                team: supportUser.team
            },
            body: {
                leadId: createdLeadId,
                counselorId: counselorUser.id
            }
        };
        const resAssign1 = mockRes();
        await supportController.assignLead(reqAssign1, resAssign1, (err) => { if (err) console.error(err); });

        console.log("Response Status:", resAssign1.statusCode || 200);
        console.log("Response JSON:", JSON.stringify(resAssign1.jsonData, null, 2));

        // Verify assignment history row
        let assignHistory1 = await prisma.leadAssignmentHistory.findFirst({
            where: { leadId: createdLeadId },
            include: {
                assignedBy: { select: { name: true } },
                assignedTo: { select: { name: true } },
                previousOwner: { select: { name: true } }
            },
            orderBy: { assignedAt: 'desc' }
        });
        console.log("\nFirst LeadAssignmentHistory Row (Verification - previousOwner should be null):");
        console.log(JSON.stringify(assignHistory1, null, 2));

        // Verify Activity Log for assignment
        const assignActivityLog = await prisma.activityLog.findFirst({
            where: {
                userId: supportUser.id,
                action: 'LEAD_ASSIGNED'
            },
            orderBy: { timestamp: 'desc' }
        });
        console.log("\nAssigned Lead ActivityLog Row (Verification):");
        console.log(JSON.stringify(assignActivityLog, null, 2));


        // --- TEST 3: Assign again to verify previousOwner is saved ---
        console.log("\n[TEST 3] Assigning lead to Team Leader to verify previousOwner is counselor...");
        const reqAssign2 = {
            user: {
                id: teamLeader.id,
                name: teamLeader.name,
                roleName: teamLeader.role.name,
                role: teamLeader.role
            },
            params: { id: createdLeadId.toString() },
            body: { userId: teamLeader.id.toString() }
        };
        const resAssign2 = mockRes();
        await leadController.assignLead(reqAssign2, resAssign2, (err) => { if (err) console.error(err); });

        // Verify assignment history row
        let assignHistory2 = await prisma.leadAssignmentHistory.findFirst({
            where: { leadId: createdLeadId },
            include: {
                assignedBy: { select: { name: true } },
                assignedTo: { select: { name: true } },
                previousOwner: { select: { name: true } }
            },
            orderBy: { assignedAt: 'desc' }
        });
        console.log("\nSecond LeadAssignmentHistory Row (Verification - previousOwner should be Counselor):");
        console.log(JSON.stringify(assignHistory2, null, 2));


        // --- TEST 4: Support convert API/lost API returns 403 ---
        console.log("\n[TEST 4] Support agent trying to mark lead as Converted via update API...");
        const reqSupportConvert = {
            user: {
                id: supportUser.id,
                name: supportUser.name,
                roleName: supportUser.role.name,
                role: supportUser.role,
                team: supportUser.team
            },
            leadScope: { assignedTo: null }, // Simulated middleware scope
            params: { id: createdLeadId.toString() },
            body: { stage: "Converted" }
        };
        const resSupportConvert = mockRes();
        await leadController.updateLead(reqSupportConvert, resSupportConvert, (err) => { if (err) console.error(err); });
        console.log("Response Status (Should be 403):", resSupportConvert.statusCode);
        console.log("Response JSON:", JSON.stringify(resSupportConvert.jsonData, null, 2));

        console.log("\n[TEST 5] Support agent trying to mark lead as Lost via update API...");
        const reqSupportLost = {
            user: {
                id: supportUser.id,
                name: supportUser.name,
                roleName: supportUser.role.name,
                role: supportUser.role,
                team: supportUser.team
            },
            leadScope: { assignedTo: null }, // Simulated middleware scope
            params: { id: createdLeadId.toString() },
            body: { stage: "Lost" }
        };
        const resSupportLost = mockRes();
        await leadController.updateLead(reqSupportLost, resSupportLost, (err) => { if (err) console.error(err); });
        console.log("Response Status (Should be 403):", resSupportLost.statusCode);
        console.log("Response JSON:", JSON.stringify(resSupportLost.jsonData, null, 2));


        // --- TEST 5: Support edit counselor-owned lead returns 403 ---
        console.log("\n[TEST 6] Support agent trying to edit counselor-assigned lead details...");
        const reqSupportEdit = {
            user: {
                id: supportUser.id,
                name: supportUser.name,
                roleName: supportUser.role.name,
                role: supportUser.role,
                team: supportUser.team
            },
            leadScope: { assignedTo: null }, // Fails since lead is assigned to teamLeader now
            params: { id: createdLeadId.toString() },
            body: { name: "Hacked Name" }
        };
        const resSupportEdit = mockRes();
        await leadController.updateLead(reqSupportEdit, resSupportEdit, (err) => { if (err) console.error(err); });
        console.log("Response Status (Should be 403):", resSupportEdit.statusCode);
        console.log("Response JSON:", JSON.stringify(resSupportEdit.jsonData, null, 2));


        // --- TEST 6: Get Timeline/History API real data return ---
        console.log("\n[TEST 7] Fetching lead story/timeline...");
        const reqStory = {
            params: { id: createdLeadId.toString() }
        };
        const resStory = mockRes();
        await counselorController.getLeadStory(reqStory, resStory, (err) => { if (err) console.error(err); });
        console.log("Response Status:", resStory.statusCode || 200);
        console.log("Response JSON (Timeline):");
        console.log(JSON.stringify(resStory.jsonData, null, 2));


        // --- CLEANUP ---
        console.log("\nCleaning up test data...");
        await prisma.leadAssignmentHistory.deleteMany({ where: { leadId: createdLeadId } });
        await prisma.activityLog.deleteMany({ where: { details: { contains: `ID: ${createdLeadId}` } } });
        await prisma.activityLog.deleteMany({ where: { details: { contains: `Lead ID ${createdLeadId}` } } });
        await prisma.lead.delete({ where: { id: createdLeadId } });
        console.log("Cleanup done.");

    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testAll();
