const cron = require('node-cron');
const prisma = require('../config/prisma');
const { SLA_THRESHOLDS } = require('../middleware/sla.middleware');

/**
 * SLA Breach Monitoring Job
 * Runs every 15 minutes to identify leads that haven't received a first response
 */
const initSlaJob = () => {
    console.log('[SLA Job] Initializing background monitor...');
    
    cron.schedule('*/15 * * * *', async () => {
        console.log('[SLA Job] Checking for breaches...');
        try {
            const now = new Date();
            const thresholdTime = new Date(now.getTime() - (SLA_THRESHOLDS.FIRST_RESPONSE * 60000));

            // Find leads created before threshold that have NO counselor response yet
            const breachingLeads = await prisma.lead.findMany({
                where: {
                    createdAt: { lt: thresholdTime },
                    messages: {
                        none: {
                            sender: { not: 'lead' }
                        }
                    },
                    // Prevent duplicate logs for the same breach
                    activities: {
                        none: {
                            action: 'SLA_BREACH_AUTO_DETECT'
                        }
                    }
                },
                select: { id: true, name: true, createdAt: true }
            });

            if (breachingLeads.length > 0) {
                console.warn(`[SLA Job] Detected ${breachingLeads.length} new SLA breaches.`);
                
                for (const lead of breachingLeads) {
                    await prisma.activityLog.create({
                        data: {
                            action: 'SLA_BREACH_AUTO_DETECT',
                            module: 'sla',
                            details: `Auto-detected SLA breach for lead "${lead.name}" (ID: ${lead.id}). No first response within ${SLA_THRESHOLDS.FIRST_RESPONSE} mins.`,
                            status: 'Failed'
                        }
                    });
                    
                    // Optionally update a flag on the lead if needed
                    // await prisma.lead.update({ where: { id: lead.id }, data: { slaBreached: true } });
                }
            }
        } catch (error) {
            console.error('[SLA Job CRITICAL ERROR]:', error.message);
        }
    });

    // Follow-up Monitor Job (Checks every hour)
    cron.schedule('0 * * * *', async () => {
        console.log('[FollowUp Job] Checking for pending and missed follow-ups...');
        try {
            const currentTime = new Date();

            // 1. Missed Follow-up Detection
            const missedFollowups = await prisma.leadFollowup.findMany({
                where: {
                    status: 'Pending',
                    scheduledTime: { lt: currentTime }
                },
                include: { lead: { select: { name: true } } }
            });

            if (missedFollowups.length > 0) {
                console.log(`[FollowUp Job] Detected ${missedFollowups.length} missed follow-ups.`);
                for (const followup of missedFollowups) {
                    await prisma.leadFollowup.update({
                        where: { id: followup.id },
                        data: { status: 'Missed' }
                    });

                    await prisma.notification.create({
                        data: {
                            userId: followup.counselorId,
                            message: `⚠️ URGENT: You missed a scheduled follow-up for lead "${followup.lead.name}".`,
                            status: 'Unread'
                        }
                    });

                    await prisma.activityLog.create({
                        data: {
                            userId: followup.counselorId,
                            action: 'FOLLOWUP_MISSED',
                            module: 'followup',
                            details: `Auto-detected missed follow-up for lead "${followup.lead.name}" (Lead ID: ${followup.leadId})`,
                            status: 'Failed'
                        }
                    }).catch(() => {});
                }
            }

            // 2. Pending Follow-up Reminders (Due today)
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            now.setHours(23, 59, 59, 999);
            const endOfDay = now;

            const dueFollowups = await prisma.leadFollowup.findMany({
                where: {
                    status: 'Pending',
                    scheduledTime: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                },
                include: { lead: { select: { name: true } } }
            });

            if (dueFollowups.length > 0) {
                console.log(`[FollowUp Job] Dispatching notifications for ${dueFollowups.length} pending follow-ups.`);
                
                for (const followup of dueFollowups) {
                    const message = `Follow-up reminder for lead "${followup.lead.name}" is scheduled for today.`;
                    
                    const existingNotif = await prisma.notification.findFirst({
                        where: {
                            userId: followup.counselorId,
                            message,
                            createdAt: { gte: startOfDay }
                        }
                    });

                    if (!existingNotif) {
                        await prisma.notification.create({
                            data: {
                                userId: followup.counselorId,
                                message,
                                status: 'Unread'
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[FollowUp Job CRITICAL ERROR]:', error.message);
        }
    });
};

module.exports = { initSlaJob };
