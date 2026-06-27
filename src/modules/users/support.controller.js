const prisma = require('../../config/prisma');

// @desc    Assign lead to counselor (Support action)
// @route   POST /api/support/assign
exports.assignLead = async (req, res, next) => {
    try {
        const { leadId, counselorId } = req.body;
        const targetLeadId = parseInt(leadId);
        const targetCounselorId = parseInt(counselorId);

        const currentLead = await prisma.lead.findUnique({
            where: { id: targetLeadId },
            select: { assignedTo: true }
        });

        if (!currentLead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        const previousOwnerId = currentLead.assignedTo;

        await prisma.$transaction(async (tx) => {
            await tx.lead.update({
                where: { id: targetLeadId },
                data: { assignedTo: targetCounselorId }
            });

            await tx.leadAssignmentHistory.create({
                data: {
                    leadId: targetLeadId,
                    assignedById: req.user?.id || null,
                    assignedToId: targetCounselorId,
                    previousOwnerId
                }
            });

            // Initialize System Message Thread for Inbox
            await tx.message.create({
                data: {
                    leadId: targetLeadId,
                    message: `System: Lead assigned to Counselor ID ${targetCounselorId}.`,
                    sender: 'System',
                    channel: 'System'
                }
            });

            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_ASSIGNED',
                    module: 'leads',
                    details: `Lead ID ${targetLeadId} manually assigned to Counselor ID ${targetCounselorId} by Support Agent ${req.user?.name}`,
                    status: 'Success'
                }
            });
        });

        res.json({ success: true, message: 'Lead assigned successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new lead (Support action)
// @route   POST /api/support/leads
exports.createLead = async (req, res, next) => {
    try {
        const { name, country, phone, email, program, source, currentAddress, sscGpa, sscPassingYear, hscGpa, hscPassingYear, bachelorCgpa, bachelorPassingYear, academicBackground, ieltsScore, moi } = req.body;

        if (!country) {
            return res.status(400).json({ success: false, message: 'Country is required to create a lead.' });
        }

        const ALLOWED_COUNTRIES = [
          "India",
          "United Kingdom",
          "USA",
          "Canada",
          "Australia",
          "France",
          "Germany",
          "UAE",
          "Singapore",
          "New Zealand"
        ];

        if (!ALLOWED_COUNTRIES.includes(country)) {
           return res.status(400).json({
              success: false,
              message: "Invalid country selected"
           });
        }

        const newLead = await prisma.$transaction(async (tx) => {
            const lead = await tx.lead.create({
                data: {
                    name,
                    country,
                    phone,
                    email,
                    program,
                    source: source || 'Social',
                    stage: 'New',
                    currentAddress,
                    sscGpa: sscGpa ? parseFloat(sscGpa) : null,
                    sscPassingYear: sscPassingYear ? parseInt(sscPassingYear) : null,
                    hscGpa: hscGpa ? parseFloat(hscGpa) : null,
                    hscPassingYear: hscPassingYear ? parseInt(hscPassingYear) : null,
                    bachelorCgpa: bachelorCgpa ? parseFloat(bachelorCgpa) : null,
                    bachelorPassingYear: bachelorPassingYear ? parseInt(bachelorPassingYear) : null,
                    academicBackground,
                    ieltsScore: ieltsScore ? parseFloat(ieltsScore) : null,
                    moi
                }
            });

            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_CREATED',
                    module: 'leads',
                    details: `Lead "${name}" created manually by Support Agent ${req.user?.name}. ID: ${lead.id}`,
                    status: 'Success'
                }
            });

            return lead;
        });

        res.status(201).json({ success: true, id: newLead.id });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk assign leads
// @route   POST /api/support/leads/bulk-assign
exports.bulkAssign = async (req, res, next) => {
    try {
        const { leadIds, counselorId } = req.body;
        const targetCounselorId = parseInt(counselorId);

        if (leadIds && leadIds.length > 0) {
            const ids = leadIds.map(id => parseInt(id));

            await prisma.$transaction(async (tx) => {
                for (const leadId of ids) {
                    const currentLead = await tx.lead.findUnique({
                        where: { id: leadId },
                        select: { assignedTo: true }
                    });

                    const previousOwnerId = currentLead ? currentLead.assignedTo : null;

                    await tx.lead.update({
                        where: { id: leadId },
                        data: { assignedTo: targetCounselorId }
                    });

                    await tx.leadAssignmentHistory.create({
                        data: {
                            leadId,
                            assignedById: req.user?.id || null,
                            assignedToId: targetCounselorId,
                            previousOwnerId
                        }
                    });

                    // Initialize System Message Thread for Inbox
                    await tx.message.create({
                        data: {
                            leadId: leadId,
                            message: `System: Lead bulk assigned to Counselor ID ${targetCounselorId}.`,
                            sender: 'System',
                            channel: 'System'
                        }
                    });
                }

                await tx.activityLog.create({
                    data: {
                        userId: req.user?.id || null,
                        action: 'BULK_LEAD_ASSIGNED',
                        module: 'leads',
                        details: `${ids.length} leads bulk-assigned to Counselor ID ${targetCounselorId} by Support Agent ${req.user?.name}`,
                        status: 'Success'
                    }
                });
            });
        }
        res.json({ success: true, message: 'Bulk assignment complete' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get support dashboard stats
// @route   GET /api/support/dashboard
exports.getDashboard = async (req, res, next) => {
    try {
        const [newMessages, unassignedLeads] = await Promise.all([
            prisma.message.count(), // No isRead in schema, count all for now
            prisma.lead.count({ where: { assignedTo: null } })
        ]);
        const aiActiveChats = 0;

        await prisma.supportDashboard.create({
            data: {
                openTickets: unassignedLeads,
                newMessages,
                assignedChats: aiActiveChats
            }
        });

        res.json({
            success: true,
            data: { newMessages, unassignedLeads, aiActiveChats }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get unassigned leads queue
// @route   GET /api/support/leads/queue
exports.getNewLeads = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            where: { assignedTo: null },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: leads });
    } catch (error) {
        next(error);
    }
};

// @desc    Get support assignment list
// @route   GET /api/support/assignment-list
exports.getAssignmentList = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            include: {
                assignedUser: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const formattedLeads = leads.map(l => ({
            ...l,
            assignedTo: l.assignedTo ? 'Assigned' : 'Pending',
            currentCounselor: l.assignedUser ? l.assignedUser.name : 'Not Assigned'
        }));

        res.json({ success: true, data: formattedLeads });
    } catch (error) {
        next(error);
    }
};

// @desc    Get AI qualification status reports
// @route   GET /api/support/ai-status
exports.getAiStatus = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            where: {
                score: { gt: 70 }
            },
            take: 20
        });

        const formattedLeads = leads.map(l => ({
            ...l,
            category: 'HOT',
            status: 'Processed',
            program: l.program || 'MBA',
            budget: '$20k',
            intake: 'Fall 2024'
        }));

        res.json({ success: true, data: formattedLeads });
    } catch (error) {
        next(error);
    }
};
