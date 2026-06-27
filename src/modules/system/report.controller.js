const prisma = require('../../config/prisma');
const ExcelJS = require('exceljs');

// Helper to parse and return date filter range based on period
const getPeriodFilter = (period) => {
    if (!period || period === 'all') return null;
    const now = new Date();
    const start = new Date(now);
    if (period === 'daily') {
        start.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else {
        return null;
    }
    return { gte: start, lte: now };
};

exports.getReportSummary = async (req, res, next) => {
    try {
        const role = req.user.roleName;
        const userId = req.user.id;
        const team = req.user.team;
        const period = req.query.period;

        // Support agents have access to reports scoped to their assignment activity
        const dateFilter = getPeriodFilter(period);

        // Setup filter based on role scope
        let leadFilter = {};
        let followupFilter = {};
        let assignmentFilter = {};

        if (role === 'COUNSELOR') {
            leadFilter.assignedTo = userId;
            followupFilter.counselorId = userId;
            assignmentFilter.assignedToId = userId;
        } else if (role === 'TEAM_LEADER') {
            leadFilter.team = team;
            followupFilter.counselor = { team: team };
            assignmentFilter.lead = { team: team };
        } else if (role === 'SUPPORT' || role === 'Customer Support') {
            leadFilter.OR = [
                { assignedTo: null },
                { assignmentHistory: { some: { assignedById: userId } } }
            ];
            followupFilter.counselorId = userId;
            assignmentFilter.assignedById = userId;
        }

        if (dateFilter) {
            assignmentFilter.assignedAt = dateFilter;
        }

        // Fetch counts for KPIs
        const [
            totalAssigned,
            convertedCount,
            lostCount,
            completedFollowups,
            missedFollowups,
            totalMessagesSent,
            totalMessagesReceived
        ] = await Promise.all([
            // Leads Assigned: query leadAssignmentHistory.assignedAt
            prisma.leadAssignmentHistory.count({ where: assignmentFilter }),
            
            // Leads Converted: query lead.updatedAt
            prisma.lead.count({ 
                where: { 
                    ...leadFilter, 
                    stage: 'Converted',
                    ...(dateFilter ? { updatedAt: dateFilter } : {})
                } 
            }),
            
            // Leads Lost: query lead.updatedAt
            prisma.lead.count({ 
                where: { 
                    ...leadFilter, 
                    stage: 'Lost',
                    ...(dateFilter ? { updatedAt: dateFilter } : {})
                } 
            }),
            
            // Follow-ups Completed: query leadFollowup.completedAt
            prisma.leadFollowup.count({ 
                where: { 
                    ...followupFilter, 
                    status: 'Completed',
                    ...(dateFilter ? { completedAt: dateFilter } : {})
                } 
            }),
            
            // Follow-ups Missed: query leadFollowup.scheduledTime
            prisma.leadFollowup.count({ 
                where: { 
                    ...followupFilter, 
                    status: 'Missed',
                    ...(dateFilter ? { scheduledTime: dateFilter } : {})
                } 
            }),
            
            // Messages Sent: query message.timestamp
            prisma.message.count({
                where: {
                    sender: { not: 'lead' },
                    ...(role === 'COUNSELOR' ? { lead: { assignedTo: userId } } : {}),
                    ...(role === 'TEAM_LEADER' ? { lead: { team: team } } : {}),
                    ...(dateFilter ? { timestamp: dateFilter } : {})
                }
            }),
            
            // Messages Received: query message.timestamp
            prisma.message.count({
                where: {
                    sender: 'lead',
                    ...(role === 'COUNSELOR' ? { lead: { assignedTo: userId } } : {}),
                    ...(role === 'TEAM_LEADER' ? { lead: { team: team } } : {}),
                    ...(dateFilter ? { timestamp: dateFilter } : {})
                }
            })
        ]);

        // Compute derived Overdue followups count (Missed and scheduledTime older than 24h)
        const overdueLimitTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const overdueScheduledCondition = { lt: overdueLimitTime };
        if (dateFilter) {
            overdueScheduledCondition.gte = dateFilter.gte;
            overdueScheduledCondition.lte = dateFilter.lte;
        }

        const overdueFollowups = await prisma.leadFollowup.count({
            where: {
                ...followupFilter,
                status: 'Missed',
                scheduledTime: overdueScheduledCondition
            }
        });

        // Exclude overdue from active missed count to avoid double-counting
        const activeMissed = Math.max(0, missedFollowups - overdueFollowups);

        // Fetch list of counselor performance metrics (only for supervisor roles)
        let counselorPerformance = [];
        if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'Super Admin'].includes(role)) {
            const counselors = await prisma.user.findMany({
                where: {
                    role: { name: 'COUNSELOR' },
                    ...(role === 'TEAM_LEADER' ? { team } : {})
                },
                select: {
                    id: true,
                    name: true,
                    team: true
                }
            });

            // Get conversion and follow-up metrics for each counselor
            counselorPerformance = await Promise.all(counselors.map(async (c) => {
                const [totalLeads, converted, completed, totalScheduled] = await Promise.all([
                    prisma.leadAssignmentHistory.count({
                        where: {
                            assignedToId: c.id,
                            ...(dateFilter ? { assignedAt: dateFilter } : {})
                        }
                    }),
                    prisma.lead.count({
                        where: {
                            assignedTo: c.id,
                            stage: 'Converted',
                            ...(dateFilter ? { updatedAt: dateFilter } : {})
                        }
                    }),
                    prisma.leadFollowup.count({
                        where: {
                            counselorId: c.id,
                            status: 'Completed',
                            ...(dateFilter ? { completedAt: dateFilter } : {})
                        }
                    }),
                    prisma.leadFollowup.count({
                        where: {
                            counselorId: c.id,
                            ...(dateFilter ? { scheduledTime: dateFilter } : {})
                        }
                    })
                ]);

                const completionRate = totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100) : 0;
                const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

                return {
                    name: c.name,
                    team: c.team,
                    leadsAssigned: totalLeads,
                    leadsConverted: converted,
                    conversionRate: `${conversionRate}%`,
                    followupsCompleted: completed,
                    followupCompletionRate: `${completionRate}%`
                };
            }));
        }

        res.json({
            success: true,
            data: {
                summary: {
                    leadsAssigned: totalAssigned,
                    leadsConverted: convertedCount,
                    leadsLost: lostCount,
                    conversionRate: totalAssigned > 0 ? `${Math.round((convertedCount / totalAssigned) * 100)}%` : '0%',
                    followupsCompleted: completedFollowups,
                    followupsMissed: activeMissed,
                    followupsOverdue: overdueFollowups,
                    messagesSent: totalMessagesSent,
                    messagesReceived: totalMessagesReceived
                },
                counselors: counselorPerformance
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getReportExport = async (req, res, next) => {
    try {
        const role = req.user.roleName;
        const userId = req.user.id;
        const team = req.user.team;
        const period = req.query.period;
        const format = req.query.format || 'csv';

        // Support agents have access to reports scoped to their assignment activity
        const dateFilter = getPeriodFilter(period);

        // Setup filter based on role scope
        let leadFilter = {};
        let followupFilter = {};
        let assignmentFilter = {};

        if (role === 'COUNSELOR') {
            leadFilter.assignedTo = userId;
            followupFilter.counselorId = userId;
            assignmentFilter.assignedToId = userId;
        } else if (role === 'TEAM_LEADER') {
            leadFilter.team = team;
            followupFilter.counselor = { team: team };
            assignmentFilter.lead = { team: team };
        } else if (role === 'SUPPORT' || role === 'Customer Support') {
            leadFilter.OR = [
                { assignedTo: null },
                { assignmentHistory: { some: { assignedById: userId } } }
            ];
            followupFilter.counselorId = userId;
            assignmentFilter.assignedById = userId;
        }

        if (dateFilter) {
            assignmentFilter.assignedAt = dateFilter;
        }

        // Fetch counts for KPIs
        const [
            totalAssigned,
            convertedCount,
            lostCount,
            completedFollowups,
            missedFollowups,
            totalMessagesSent,
            totalMessagesReceived
        ] = await Promise.all([
            // Leads Assigned: query leadAssignmentHistory.assignedAt
            prisma.leadAssignmentHistory.count({ where: assignmentFilter }),
            
            // Leads Converted: query lead.updatedAt
            prisma.lead.count({ 
                where: { 
                    ...leadFilter, 
                    stage: 'Converted',
                    ...(dateFilter ? { updatedAt: dateFilter } : {})
                } 
            }),
            
            // Leads Lost: query lead.updatedAt
            prisma.lead.count({ 
                where: { 
                    ...leadFilter, 
                    stage: 'Lost',
                    ...(dateFilter ? { updatedAt: dateFilter } : {})
                } 
            }),
            
            // Follow-ups Completed: query leadFollowup.completedAt
            prisma.leadFollowup.count({ 
                where: { 
                    ...followupFilter, 
                    status: 'Completed',
                    ...(dateFilter ? { completedAt: dateFilter } : {})
                } 
            }),
            
            // Follow-ups Missed: query leadFollowup.scheduledTime
            prisma.leadFollowup.count({ 
                where: { 
                    ...followupFilter, 
                    status: 'Missed',
                    ...(dateFilter ? { scheduledTime: dateFilter } : {})
                } 
            }),
            
            // Messages Sent: query message.timestamp
            prisma.message.count({
                where: {
                    sender: { not: 'lead' },
                    ...(role === 'COUNSELOR' ? { lead: { assignedTo: userId } } : {}),
                    ...(role === 'TEAM_LEADER' ? { lead: { team: team } } : {}),
                    ...(dateFilter ? { timestamp: dateFilter } : {})
                }
            }),
            
            // Messages Received: query message.timestamp
            prisma.message.count({
                where: {
                    sender: 'lead',
                    ...(role === 'COUNSELOR' ? { lead: { assignedTo: userId } } : {}),
                    ...(role === 'TEAM_LEADER' ? { lead: { team: team } } : {}),
                    ...(dateFilter ? { timestamp: dateFilter } : {})
                }
            })
        ]);

        // Compute derived Overdue followups count (Missed and scheduledTime older than 24h)
        const overdueLimitTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const overdueScheduledCondition = { lt: overdueLimitTime };
        if (dateFilter) {
            overdueScheduledCondition.gte = dateFilter.gte;
            overdueScheduledCondition.lte = dateFilter.lte;
        }

        const overdueFollowups = await prisma.leadFollowup.count({
            where: {
                ...followupFilter,
                status: 'Missed',
                scheduledTime: overdueScheduledCondition
            }
        });

        // Exclude overdue from active missed count to avoid double-counting
        const activeMissed = Math.max(0, missedFollowups - overdueFollowups);

        // Fetch list of counselor performance metrics (only for supervisor roles)
        let counselorPerformance = [];
        if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'Super Admin'].includes(role)) {
            const counselors = await prisma.user.findMany({
                where: {
                    role: { name: 'COUNSELOR' },
                    ...(role === 'TEAM_LEADER' ? { team } : {})
                },
                select: {
                    id: true,
                    name: true,
                    team: true
                }
            });

            // Get conversion and follow-up metrics for each counselor
            counselorPerformance = await Promise.all(counselors.map(async (c) => {
                const [totalLeads, converted, completed, totalScheduled] = await Promise.all([
                    prisma.leadAssignmentHistory.count({
                        where: {
                            assignedToId: c.id,
                            ...(dateFilter ? { assignedAt: dateFilter } : {})
                        }
                    }),
                    prisma.lead.count({
                        where: {
                            assignedTo: c.id,
                            stage: 'Converted',
                            ...(dateFilter ? { updatedAt: dateFilter } : {})
                        }
                    }),
                    prisma.leadFollowup.count({
                        where: {
                            counselorId: c.id,
                            status: 'Completed',
                            ...(dateFilter ? { completedAt: dateFilter } : {})
                        }
                    }),
                    prisma.leadFollowup.count({
                        where: {
                            counselorId: c.id,
                            ...(dateFilter ? { scheduledTime: dateFilter } : {})
                        }
                    })
                ]);

                const completionRate = totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100) : 0;
                const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

                return {
                    name: c.name,
                    team: c.team,
                    leadsAssigned: totalLeads,
                    leadsConverted: converted,
                    conversionRate: `${conversionRate}%`,
                    followupsCompleted: completed,
                    followupCompletionRate: `${completionRate}%`
                };
            }));
        }

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            
            // 1. Summary Sheet
            const summarySheet = workbook.addWorksheet('Summary');
            summarySheet.columns = [
                { header: 'Metric', key: 'metric', width: 25 },
                { header: 'Value', key: 'value', width: 15 }
            ];
            
            summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            summarySheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F2937' } // dark slate/gray background
            };
            
            summarySheet.addRow({ metric: 'Leads Assigned', value: totalAssigned });
            summarySheet.addRow({ metric: 'Leads Converted', value: convertedCount });
            summarySheet.addRow({ metric: 'Leads Lost', value: lostCount });
            summarySheet.addRow({ metric: 'Conversion Rate', value: `${totalAssigned > 0 ? Math.round((convertedCount / totalAssigned) * 100) : 0}%` });
            summarySheet.addRow({ metric: 'Follow-ups Completed', value: completedFollowups });
            summarySheet.addRow({ metric: 'Follow-ups Missed', value: activeMissed });
            summarySheet.addRow({ metric: 'Follow-ups Overdue', value: overdueFollowups });
            summarySheet.addRow({ metric: 'Messages Sent', value: totalMessagesSent });
            summarySheet.addRow({ metric: 'Messages Received', value: totalMessagesReceived });

            // Apply borders to Summary sheet cells
            summarySheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });

            // 2. Counselor Performance Sheet if Supervisor
            if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'Super Admin'].includes(role)) {
                const perfSheet = workbook.addWorksheet('Counselor Performance');
                perfSheet.columns = [
                    { header: 'Counselor', key: 'name', width: 25 },
                    { header: 'Team', key: 'team', width: 15 },
                    { header: 'Assigned Leads', key: 'leadsAssigned', width: 15 },
                    { header: 'Converted Leads', key: 'leadsConverted', width: 15 },
                    { header: 'Conversion Rate', key: 'conversionRate', width: 15 },
                    { header: 'Follow-ups Completed', key: 'followupsCompleted', width: 22 }
                ];

                perfSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                perfSheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F2937' } // dark slate/gray background
                };

                counselorPerformance.forEach(c => {
                    perfSheet.addRow({
                        name: c.name,
                        team: c.team || 'General',
                        leadsAssigned: c.leadsAssigned,
                        leadsConverted: c.leadsConverted,
                        conversionRate: c.conversionRate,
                        followupsCompleted: c.followupsCompleted
                    });
                });

                perfSheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        };
                    });
                });
            }

            // 3. Customer Details Sheet (Phase-3 Academic Profile Export) - Only for ADMIN, MANAGER, SUPER_ADMIN
            if (['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'Super Admin'].includes(role.toUpperCase())) {
                const customerLeads = await prisma.lead.findMany({
                    where: {
                        ...leadFilter,
                        ...(dateFilter ? { createdAt: dateFilter } : {})
                    },
                    include: {
                        assignedUser: { select: { name: true } },
                        messages: {
                            orderBy: { timestamp: 'desc' },
                            take: 1
                        },
                        followups: {
                            orderBy: { scheduledTime: 'desc' }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                const customerSheet = workbook.addWorksheet('Customer Details');
                customerSheet.columns = [
                    { header: 'ID', key: 'id', width: 10 },
                    { header: 'Name', key: 'name', width: 25 },
                    { header: 'Email', key: 'email', width: 30 },
                    { header: 'Phone', key: 'phone', width: 20 },
                    { header: 'Stage', key: 'stage', width: 15 },
                    { header: 'Address', key: 'currentAddress', width: 30 },
                    { header: 'SSC GPA', key: 'sscGpa', width: 15 },
                    { header: 'SSC Year', key: 'sscPassingYear', width: 15 },
                    { header: 'HSC GPA', key: 'hscGpa', width: 15 },
                    { header: 'HSC Year', key: 'hscPassingYear', width: 15 },
                    { header: 'Bachelor CGPA', key: 'bachelorCgpa', width: 15 },
                    { header: 'Bachelor Year', key: 'bachelorPassingYear', width: 15 },
                    { header: 'Background', key: 'academicBackground', width: 20 },
                    { header: 'IELTS', key: 'ieltsScore', width: 15 },
                    { header: 'MOI', key: 'moi', width: 15 },
                    { header: 'Last Conversation Date', key: 'lastConversationDate', width: 25 },
                    { header: 'Follow-up Note', key: 'followUpNote', width: 30 },
                    { header: 'Next Follow-up Date', key: 'nextFollowUpDate', width: 25 },
                    { header: 'Assigned Counselor', key: 'assignedCounselor', width: 25 }
                ];

                customerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                customerSheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F2937' } 
                };

                customerLeads.forEach(l => {
                    const lastMsg = l.messages[0];
                    const latestFollowUp = l.followups[0];
                    const nextPendingFollowUp = l.followups.find(f => f.status === 'Pending');

                    customerSheet.addRow({
                        id: l.id,
                        name: l.name,
                        email: l.email,
                        phone: l.phone,
                        stage: l.stage,
                        currentAddress: l.currentAddress,
                        sscGpa: l.sscGpa,
                        sscPassingYear: l.sscPassingYear,
                        hscGpa: l.hscGpa,
                        hscPassingYear: l.hscPassingYear,
                        bachelorCgpa: l.bachelorCgpa,
                        bachelorPassingYear: l.bachelorPassingYear,
                        academicBackground: l.academicBackground,
                        ieltsScore: l.ieltsScore,
                        moi: l.moi,
                        lastConversationDate: lastMsg ? new Date(lastMsg.timestamp).toLocaleString() : 'N/A',
                        followUpNote: latestFollowUp ? latestFollowUp.notes || 'N/A' : 'N/A',
                        nextFollowUpDate: nextPendingFollowUp ? new Date(nextPendingFollowUp.scheduledTime).toLocaleString() : (l.followUpDate ? new Date(l.followUpDate).toLocaleString() : 'N/A'),
                        assignedCounselor: l.assignedUser ? l.assignedUser.name : 'Unassigned'
                    });
                });

                customerSheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        };
                    });
                });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="performance-report-${new Date().toISOString().split('T')[0]}.xlsx"`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            // Default: CSV format
            let csvContent = 'METRIC,VALUE\n';
            csvContent += `Leads Assigned,${totalAssigned}\n`;
            csvContent += `Leads Converted,${convertedCount}\n`;
            csvContent += `Leads Lost,${lostCount}\n`;
            csvContent += `Conversion Rate,${totalAssigned > 0 ? Math.round((convertedCount / totalAssigned) * 100) : 0}%\n`;
            csvContent += `Follow-ups Completed,${completedFollowups}\n`;
            csvContent += `Follow-ups Missed,${activeMissed}\n`;
            csvContent += `Follow-ups Overdue,${overdueFollowups}\n`;
            csvContent += `Messages Sent,${totalMessagesSent}\n`;
            csvContent += `Messages Received,${totalMessagesReceived}\n\n`;

            if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'Super Admin'].includes(role)) {
                csvContent += 'COUNSELOR,TEAM,ASSIGNED LEADS,CONVERTED LEADS,CONVERSION RATE,FOLLOWUPS COMPLETED\n';
                for (const c of counselorPerformance) {
                    csvContent += `"${c.name}","${c.team || 'General'}",${c.leadsAssigned},${c.leadsConverted},"${c.conversionRate}",${c.followupsCompleted}\n`;
                }
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="performance-report-${new Date().toISOString().split('T')[0]}.csv"`);
            res.status(200).send(csvContent);
        }
    } catch (error) {
        next(error);
    }
};
