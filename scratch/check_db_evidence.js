const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("=== DB SCHEMA AND MIGRATION VERIFICATION ===");
        
        // 1. Check if lead_assignment_history table exists and show count
        try {
            const assignmentCount = await prisma.leadAssignmentHistory.count();
            console.log(`[PASS] LeadAssignmentHistory table exists. Count: ${assignmentCount}`);
            
            // Get recent assignment history records
            const recentAssignments = await prisma.leadAssignmentHistory.findMany({
                take: 5,
                orderBy: { assignedAt: 'desc' },
                include: {
                    lead: { select: { id: true, name: true } },
                    assignedBy: { select: { id: true, name: true, role: { select: { name: true } } } },
                    assignedTo: { select: { id: true, name: true } },
                    previousOwner: { select: { id: true, name: true } }
                }
            });
            console.log("\n--- Recent Lead Assignment History ---");
            console.log(JSON.stringify(recentAssignments, null, 2));
        } catch (err) {
            console.error("[FAIL] Error querying LeadAssignmentHistory:", err.message);
        }

        // 2. Check Activity Logs
        try {
            const logCount = await prisma.activityLog.count();
            console.log(`\n[PASS] ActivityLog table exists. Count: ${logCount}`);

            const recentLogs = await prisma.activityLog.findMany({
                take: 10,
                orderBy: { timestamp: 'desc' },
                include: {
                    user: { select: { id: true, name: true, role: { select: { name: true } } } }
                }
            });
            console.log("\n--- Recent Activity Logs ---");
            console.log(JSON.stringify(recentLogs, null, 2));
        } catch (err) {
            console.error("[FAIL] Error querying ActivityLog:", err.message);
        }

        // 3. Check follow-ups
        try {
            const followupCount = await prisma.leadFollowup.count();
            console.log(`\n[PASS] LeadFollowup table exists. Count: ${followupCount}`);
            
            const recentFollowups = await prisma.leadFollowup.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    lead: { select: { id: true, name: true } },
                    counselor: { select: { id: true, name: true } }
                }
            });
            console.log("\n--- Recent Followups ---");
            console.log(JSON.stringify(recentFollowups, null, 2));
        } catch (err) {
            console.error("[FAIL] Error querying LeadFollowup:", err.message);
        }

    } catch (err) {
        console.error("Critical error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
