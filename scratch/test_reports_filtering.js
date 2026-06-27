const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const ExcelJS = require('exceljs');

async function testReports() {
    console.log("=== INTEGRATION REPORTING & EXPORT CHECKS ===");

    // 1. Load users for testing
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
        if (!users[role]) {
            console.error(`User for role ${role} not found in database.`);
            return;
        }
        users[role].token = `Bearer ${jwt.sign({ id: users[role].id }, process.env.JWT_SECRET)}`;
    }

    // Set counselor team to match team leader for scoping
    await prisma.user.update({
        where: { id: users['COUNSELOR'].id },
        data: { team: users['TEAM_LEADER'].team }
    });

    // 2. Insert some dummy data to verify period metrics
    console.log("Creating dummy report records...");
    const counselorUser = users['COUNSELOR'];

    // Create a lead
    const testLead = await prisma.lead.create({
        data: {
            name: "Report Test Lead",
            assignedTo: counselorUser.id,
            team: counselorUser.team || "Alpha Squad",
            stage: "Converted",
            updatedAt: new Date() // Converted today
        }
    });

    // Add Lead Assignment History (Assigned Today)
    const assignmentHistory = await prisma.leadAssignmentHistory.create({
        data: {
            leadId: testLead.id,
            assignedToId: counselorUser.id,
            assignedById: users['ADMIN'].id,
            assignedAt: new Date()
        }
    });

    // Create completed followup (Completed Today)
    const testFollowup = await prisma.leadFollowup.create({
        data: {
            leadId: testLead.id,
            counselorId: counselorUser.id,
            scheduledTime: new Date(Date.now() - 3600000), // 1 hour ago
            status: "Completed",
            completedAt: new Date()
        }
    });

    // Create missed followup (Missed Today)
    const missedFollowup = await prisma.leadFollowup.create({
        data: {
            leadId: testLead.id,
            counselorId: counselorUser.id,
            scheduledTime: new Date(Date.now() - 7200000), // 2 hours ago
            status: "Missed"
        }
    });

    // Create messages (Today)
    const sentMsg = await prisma.message.create({
        data: {
            leadId: testLead.id,
            sender: "agent",
            message: "Hello this is counselor",
            agentId: counselorUser.id,
            timestamp: new Date()
        }
    });

    const recvMsg = await prisma.message.create({
        data: {
            leadId: testLead.id,
            sender: "lead",
            message: "Hello counselor",
            timestamp: new Date()
        }
    });

    console.log("Running role permission checks for reports...");

    // Test 1: Support user access (should be denied)
    const supportRes = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', users['SUPPORT'].token);
    
    console.log(`Support user report access: Status = ${supportRes.status} (Expected: 403)`);
    if (supportRes.status !== 403) {
        console.error("FAIL: Support user was not denied access to reports.");
    } else {
        console.log("PASS: Support user successfully denied reports access.");
    }

    // Test 2: Counselor user access (should show summary, restricted to counselor data)
    const counselorRes = await request(app)
        .get('/api/reports/summary?period=daily')
        .set('Authorization', counselorUser.token);
    
    console.log(`Counselor report access: Status = ${counselorRes.status} (Expected: 200)`);
    if (counselorRes.status === 200) {
        console.log("PASS: Counselor report access succeeded.");
        const summary = counselorRes.body.data.summary;
        console.log("Counselor Summary (Daily):", summary);
        if (summary.leadsAssigned >= 1 && summary.leadsConverted >= 1 && summary.followupsCompleted >= 1) {
            console.log("PASS: Counselor daily metrics correctly calculated.");
        } else {
            console.error("FAIL: Counselor metrics calculation incorrect.");
        }
    } else {
        console.error("FAIL: Counselor report access failed.");
    }

    // Test 3: Admin user access (should show all counselor performance too)
    const adminRes = await request(app)
        .get('/api/reports/summary?period=daily')
        .set('Authorization', users['ADMIN'].token);
    
    console.log(`Admin report access: Status = ${adminRes.status} (Expected: 200)`);
    if (adminRes.status === 200) {
        console.log("PASS: Admin report access succeeded.");
        const counselorsList = adminRes.body.data.counselors;
        console.log("Counselors performance count:", counselorsList.length);
        const counselorRecord = counselorsList.find(c => c.name === counselorUser.name);
        if (counselorRecord) {
            console.log(`PASS: Found test counselor "${counselorUser.name}" performance:`, counselorRecord);
        } else {
            console.error("FAIL: Counselor performance record not found in admin response.");
        }
    } else {
        console.error("FAIL: Admin report access failed.");
    }

    // Test 4: Export report to CSV
    console.log("Testing export to CSV format...");
    const csvRes = await request(app)
        .get('/api/reports/export?period=daily&format=csv')
        .set('Authorization', users['ADMIN'].token);

    console.log(`CSV Export status: ${csvRes.status} (Expected: 200)`);
    console.log(`CSV Export content-type: ${csvRes.headers['content-type']}`);
    if (csvRes.status === 200 && csvRes.headers['content-type'].includes('text/csv')) {
        console.log("PASS: CSV export works. Sample lines:\n", csvRes.text.split('\n').slice(0, 5).join('\n'));
    } else {
        console.error("FAIL: CSV export check failed.");
    }

    // Test 5: Export report to XLSX
    console.log("Testing export to XLSX format...");
    const xlsxRes = await request(app)
        .get('/api/reports/export?period=daily&format=xlsx')
        .set('Authorization', users['ADMIN'].token)
        .responseType('blob'); // Get buffer

    console.log(`XLSX Export status: ${xlsxRes.status} (Expected: 200)`);
    console.log(`XLSX Export content-type: ${xlsxRes.headers['content-type']}`);
    if (xlsxRes.status === 200 && xlsxRes.headers['content-type'].includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        // Load workbook to verify integrity
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(xlsxRes.body);
        const summarySheet = workbook.getWorksheet('Summary');
        const perfSheet = workbook.getWorksheet('Counselor Performance');
        if (summarySheet && perfSheet) {
            console.log("PASS: XLSX workbook matches schema and contains worksheets 'Summary' and 'Counselor Performance'.");
            console.log(`Summary rows: ${summarySheet.rowCount}, Performance rows: ${perfSheet.rowCount}`);
        } else {
            console.error("FAIL: XLSX worksheet layout check failed.");
        }
    } else {
        console.error("FAIL: XLSX export check failed.");
    }

    // 3. Clean up the test records
    console.log("Cleaning up dummy test records...");
    await prisma.message.deleteMany({ where: { id: { in: [sentMsg.id, recvMsg.id] } } });
    await prisma.leadFollowup.deleteMany({ where: { id: { in: [testFollowup.id, missedFollowup.id] } } });
    await prisma.leadAssignmentHistory.deleteMany({ where: { id: assignmentHistory.id } });
    await prisma.lead.delete({ where: { id: testLead.id } });
    console.log("Cleanup complete!");
}

testReports()
    .then(() => prisma.$disconnect())
    .catch(err => {
        console.error(err);
        prisma.$disconnect();
    });
