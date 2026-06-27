const prisma = require('../../config/prisma');
const socketManager = require('../../sockets/socketManager');

// ─────────────────────────────────────────────────
// ROUND ROBIN ASSIGNMENT ENGINE
// ─────────────────────────────────────────────────

/**
 * Get next available counselor using Round Robin logic
 * - Only picks Active counselors with COUNSELOR role
 * - Distributes based on least leads assigned
 */
const getNextCounselor = async (tx, team = null) => {
    const where = {
        status: 'Active',
        role: { name: 'COUNSELOR' }
    };

    if (team) where.team = team;

    // Strict Round Robin: Pick counselor with oldest lastAssignedAt
    // Atomic: We perform this within the provided transaction context
    const counselor = await tx.user.findFirst({
        where,
        orderBy: [
            { lastAssignedAt: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    if (!counselor) return null;

    // Mark as assigned NOW to prevent race conditions in same transaction block
    const updated = await tx.user.update({
        where: { id: counselor.id },
        data: { lastAssignedAt: new Date() }
    });

    return updated;
};

// ─────────────────────────────────────────────────
// GET ALL LEADS (with Role Scope)
// ─────────────────────────────────────────────────
exports.getLeads = async (req, res, next) => {
    try {
        const { 
            country, status, dateRange, search, academicBackground, moi, 
            ieltsRange, bachelorCgpaRange, sscPassingYearRange, hscPassingYearRange, bachelorPassingYearRange,
            priority, source, branch, leadType, assignedTo, nextFollowUpDate
        } = req.query;
        const role = req.user?.roleName || req.user?.role?.name || '';

        const where = { ...req.leadScope };

        if (country && country !== 'Global') {
            // Counselors must always see leads assigned to them regardless of country value
            if (role !== 'COUNSELOR') {
                where.country = country;
            }
        }
        if (status && status !== 'All Stages') where.stage = status;
        if (academicBackground) where.academicBackground = academicBackground;
        if (moi) where.moi = moi;

        // Date Range Filter
        if (dateRange && dateRange !== 'All') {
            const now = new Date();
            const start = new Date(now);
            let applyDateFilter = true;
            if (dateRange.toLowerCase() === 'today') {
                start.setHours(0, 0, 0, 0);
            } else if (dateRange.toLowerCase() === 'weekly' || dateRange.toLowerCase() === 'last 7 days') {
                start.setDate(now.getDate() - 7);
            } else if (dateRange.toLowerCase() === 'monthly' || dateRange.toLowerCase() === 'last 30 days') {
                start.setDate(now.getDate() - 30);
            } else {
                applyDateFilter = false;
            }
            if (applyDateFilter) {
                where.createdAt = { gte: start, lte: now };
            }
        }

        // Assigned Counselor Filter
        if (assignedTo && assignedTo !== 'All') {
            if (assignedTo === 'Unassigned') {
                where.assignedTo = null;
            } else {
                where.assignedTo = parseInt(assignedTo);
            }
        }

        // Priority Filter
        if (priority && priority !== 'All') {
            where.priority = priority;
        }

        // Source Filter
        if (source && source !== 'All') {
            where.source = source;
        }

        // Branch Filter
        if (branch && branch !== 'All') {
            where.branch = branch;
        }

        // Lead Type Filter
        if (leadType && leadType !== 'All') {
            where.leadType = leadType;
        }

        // Next Follow-up Date Filter
        if (nextFollowUpDate) {
            const followUpLimit = new Date(nextFollowUpDate);
            const startLimit = new Date(followUpLimit);
            startLimit.setHours(0, 0, 0, 0);
            const endLimit = new Date(followUpLimit);
            endLimit.setHours(23, 59, 59, 999);
            where.followUpDate = { gte: startLimit, lte: endLimit };
        }

        const parseRange = (field, rangeStr) => {
            if (rangeStr && rangeStr.includes('-')) {
                const [min, max] = rangeStr.split('-');
                if (min && max) {
                    where[field] = { gte: parseFloat(min), lte: parseFloat(max) };
                }
            }
        };

        parseRange('ieltsScore', ieltsRange);
        parseRange('bachelorCgpa', bachelorCgpaRange);
        parseRange('sscPassingYear', sscPassingYearRange);
        parseRange('hscPassingYear', hscPassingYearRange);
        parseRange('bachelorPassingYear', bachelorPassingYearRange);

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        const leads = await prisma.lead.findMany({
            where,
            include: {
                assignedUser: { select: { name: true, id: true } },
                status: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const flattenedLeads = leads.map(l => {
            const { assignedUser, ...rest } = l;
            return {
                ...rest,
                handlerName: assignedUser ? assignedUser.name : null
            };
        });

        res.json({
            success: true,
            message: 'Leads retrieved successfully',
            data: flattenedLeads,
            total: flattenedLeads.length
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// CREATE LEAD + AUTO ASSIGN (BULLETPROOF VERSION)
// ─────────────────────────────────────────────────
exports.createLead = async (req, res, next) => {
    try {
        const { name, country, phone, email, program, stage, score, source, assignedTo, team, priority, currentAddress, sscGpa, sscPassingYear, hscGpa, hscPassingYear, bachelorCgpa, bachelorPassingYear, academicBackground, ieltsScore, moi, branch, leadType } = req.body;

        if (!country) {
            return res.status(400).json({ success: false, message: 'Country is required to create a lead.' });
        }

        // Atomic Transaction Start
        const result = await prisma.$transaction(async (tx) => {
            
            // 1. Resolve Status
            let statusEntity = await tx.leadStatus.findUnique({
                where: { name: stage || 'New' }
            });
            if (!statusEntity) {
                statusEntity = await tx.leadStatus.findFirst({ where: { name: 'New' } });
            }

            // 2. Auto-assignment Logic (Atomic inside transaction)
            let finalAssignedTo = assignedTo ? parseInt(assignedTo) : null;
            let autoAssigned = false;

            if (!finalAssignedTo) {
                const counselor = await getNextCounselor(tx, team);
                if (counselor) {
                    finalAssignedTo = counselor.id;
                    autoAssigned = true;
                }
            } else {
                // Manual assignment still updates the timestamp to keep them in the loop
                await tx.user.update({
                    where: { id: finalAssignedTo },
                    data: { lastAssignedAt: new Date() }
                }).catch(() => {}); // Ignore if user doesn't exist or isn't a counselor
            }

            // 3. Create Lead
            const newLead = await tx.lead.create({
                data: {
                    name,
                    country,
                    phone,
                    email,
                    program,
                    statusId: statusEntity ? statusEntity.id : null,
                    stage: stage || 'New',
                    score: score || 0,
                    source: source || 'Website',
                    assignedTo: finalAssignedTo,
                    team: team || 'General',
                    priority: priority || 'Medium',
                    currentAddress,
                    sscGpa: sscGpa ? parseFloat(sscGpa) : null,
                    sscPassingYear: sscPassingYear ? parseInt(sscPassingYear) : null,
                    hscGpa: hscGpa ? parseFloat(hscGpa) : null,
                    hscPassingYear: hscPassingYear ? parseInt(hscPassingYear) : null,
                    bachelorCgpa: bachelorCgpa ? parseFloat(bachelorCgpa) : null,
                    bachelorPassingYear: bachelorPassingYear ? parseInt(bachelorPassingYear) : null,
                    academicBackground,
                    ieltsScore: ieltsScore ? parseFloat(ieltsScore) : null,
                    moi,
                    branch,
                    leadType
                },
                include: { status: true }
            });

            // Initialize System Message Thread for Inbox
            await tx.message.create({
                data: {
                    leadId: newLead.id,
                    message: `System: Lead created and assigned.`,
                    sender: 'System',
                    channel: 'System'
                }
            });

            // 4. Atomic Audit Log
            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_CREATED',
                    module: 'leads',
                    details: `Lead "${name}" created. ${autoAssigned ? 'Auto-assigned.' : 'Manual.'} ID: ${newLead.id}`,
                    status: 'Success'
                }
            });

            return { newLead, autoAssigned };
        }, {
            timeout: 10000 // 10s timeout for safety
        });

        // Outside transaction: Async tasks
        socketManager.events.leadNew(result.newLead);
        socketManager.events.dashboardRefresh({ trigger: 'lead_created' });

        res.status(201).json({
            success: true,
            message: `Lead created successfully${result.autoAssigned ? ' (auto-assigned)' : ''}`,
            data: result.newLead,
            autoAssigned: result.autoAssigned
        });
    } catch (error) {
        console.error('[LEAD CREATION CRITICAL ERROR]:', error.message);
        next(error);
    }
};

// ─────────────────────────────────────────────────
// UPDATE LEAD
// ─────────────────────────────────────────────────
exports.updateLead = async (req, res, next) => {
    try {
        const { name, country, phone, email, program, stage, score, source, assignedTo, team, priority, followUpDate, currentAddress, sscGpa, sscPassingYear, hscGpa, hscPassingYear, bachelorCgpa, bachelorPassingYear, academicBackground, ieltsScore, moi, branch, leadType } = req.body;
        const leadId = parseInt(req.params.id);
        const role = req.user?.roleName || req.user?.role?.name || '';

        // Counselors can only update their own leads
        if (role === 'COUNSELOR') {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead || lead.assignedTo !== req.user.id) {
                return res.status(403).json({ success: false, message: 'You can only update your own leads.' });
            }
        }

        // Support agents cannot edit counselor-owned leads
        if (role === 'SUPPORT') {
            const lead = await prisma.lead.findFirst({
                where: { id: leadId, ...req.leadScope }
            });
            if (!lead) {
                return res.status(403).json({ success: false, message: 'Access denied: You cannot edit leads that are assigned to a counselor.' });
            }
            if (stage && ['Converted', 'Lost'].includes(stage)) {
                return res.status(403).json({ success: false, message: 'Support agents are not authorized to convert leads or mark them lost.' });
            }
        }

        // Interaction-Based Conversion Validation
        if (stage && ['Converted', 'Lost'].includes(stage)) {
            const disableValidation = process.env.DISABLE_LEAD_CONVERSION_VALIDATION === 'true';
            if (!disableValidation) {
                const isManagerOrAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role);
                const hasOverride = req.body.managerOverride === true && isManagerOrAdmin;

                if (!hasOverride) {
                    const [messageCount, callCount, followupCount] = await Promise.all([
                        prisma.message.count({
                            where: { leadId, sender: { notIn: ['lead', 'System'] } }
                        }),
                        prisma.call.count({
                            where: { leadId, outcome: 'Connected' }
                        }),
                        prisma.leadFollowup.count({
                            where: { leadId, status: 'Completed' }
                        })
                    ]);

                    if (messageCount === 0 && callCount === 0 && followupCount === 0) {
                        return res.status(403).json({
                            success: false,
                            message: 'Lead cannot be converted or marked lost without proper interaction history (at least one outgoing message, connected call, or completed follow-up), or manager override.'
                        });
                    }
                }
            }
        }

        let data = {};
        if (name) data.name = name;
        if (country) data.country = country;
        if (phone) data.phone = phone;
        if (email) data.email = email;
        if (program) data.program = program;
        if (stage) {
            data.stage = stage;
            const statusEntity = await prisma.leadStatus.findUnique({ where: { name: stage } });
            if (statusEntity) data.statusId = statusEntity.id;
        }
        if (score !== undefined) data.score = score;
        if (source) data.source = source;
        if (assignedTo !== undefined) data.assignedTo = assignedTo || null;
        if (team) data.team = team;
        if (priority) data.priority = priority;
        if (followUpDate) data.followUpDate = new Date(followUpDate);
        if (currentAddress !== undefined) data.currentAddress = currentAddress;
        if (sscGpa !== undefined) data.sscGpa = sscGpa ? parseFloat(sscGpa) : null;
        if (sscPassingYear !== undefined) data.sscPassingYear = sscPassingYear ? parseInt(sscPassingYear) : null;
        if (hscGpa !== undefined) data.hscGpa = hscGpa ? parseFloat(hscGpa) : null;
        if (hscPassingYear !== undefined) data.hscPassingYear = hscPassingYear ? parseInt(hscPassingYear) : null;
        if (bachelorCgpa !== undefined) data.bachelorCgpa = bachelorCgpa ? parseFloat(bachelorCgpa) : null;
        if (bachelorPassingYear !== undefined) data.bachelorPassingYear = bachelorPassingYear ? parseInt(bachelorPassingYear) : null;
        if (academicBackground !== undefined) data.academicBackground = academicBackground;
        if (ieltsScore !== undefined) data.ieltsScore = ieltsScore ? parseFloat(ieltsScore) : null;
        if (moi !== undefined) data.moi = moi;
        if (branch !== undefined) data.branch = branch;
        if (leadType !== undefined) data.leadType = leadType;

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const oldLead = await prisma.lead.findUnique({ where: { id: leadId } });
        const updatedLead = await prisma.lead.update({ where: { id: leadId }, data });

        const academicFields = [
            { key: 'currentAddress', label: 'Address' },
            { key: 'sscGpa', label: 'SSC GPA' },
            { key: 'sscPassingYear', label: 'SSC Passing Year' },
            { key: 'hscGpa', label: 'HSC GPA' },
            { key: 'hscPassingYear', label: 'HSC Passing Year' },
            { key: 'bachelorCgpa', label: 'Bachelor CGPA' },
            { key: 'bachelorPassingYear', label: 'Bachelor Passing Year' },
            { key: 'academicBackground', label: 'Academic Background' },
            { key: 'ieltsScore', label: 'IELTS Score' },
            { key: 'moi', label: 'MOI' }
        ];

        let academicChanges = [];
        academicFields.forEach(field => {
            if (data[field.key] !== undefined && oldLead[field.key] !== data[field.key]) {
                const oldVal = oldLead[field.key] ?? 'N/A';
                const newVal = data[field.key] ?? 'N/A';
                if (oldVal !== newVal) {
                    academicChanges.push(`${field.label} changed from ${oldVal} to ${newVal}`);
                }
            }
        });

        if (academicChanges.length > 0) {
            await prisma.activity.create({
                data: {
                    userId: req.user?.id || null,
                    leadId: leadId,
                    action: 'ACADEMIC_PROFILE_UPDATED',
                    details: academicChanges.join(', ')
                }
            }).catch(() => {});
        }

        // SLA Tracking: Resolution
        if (['Converted', 'Lost'].includes(stage)) {
            const { trackSLA } = require('../../middleware/sla.middleware');
            await trackSLA(leadId, 'RESOLUTION', req.user?.id);
        }

        // Audit log
        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'LEAD_UPDATED',
                module: 'leads',
                details: `Lead ID ${leadId} updated. Stage: ${stage || 'unchanged'}`,
                status: 'Success'
            }
        }).catch(() => {});

        socketManager.events.leadUpdate(updatedLead);
        if (stage) socketManager.events.dashboardRefresh({ trigger: 'lead_stage_changed', stage });

        res.json({ success: true, message: 'Lead updated successfully', data: updatedLead });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// DELETE LEAD
// ─────────────────────────────────────────────────
exports.deleteLead = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);

        await prisma.lead.delete({ where: { id: leadId } });

        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'LEAD_DELETED',
                module: 'leads',
                details: `Lead ID ${leadId} deleted by ${req.user?.name}`,
                status: 'Success'
            }
        }).catch(() => {});

        socketManager.events.leadDelete(leadId);
        socketManager.events.dashboardRefresh({ trigger: 'lead_deleted' });

        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────
// ASSIGN LEAD (Manual — Team Leader/Admin)
// ─────────────────────────────────────────────────
exports.assignLead = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const { userId } = req.body;
        const targetUserId = userId ? parseInt(userId) : null;

        // Fetch current owner first to identify previous owner
        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { assignedTo: true }
        });

        if (!currentLead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        const previousOwnerId = currentLead.assignedTo;

        const updatedLead = await prisma.$transaction(async (tx) => {
            const lead = await tx.lead.update({
                where: { id: leadId },
                data: {
                    assignedTo: targetUserId,
                    stage: 'Assigned'
                }
            });

            // Initialize System Message Thread for Inbox
            await tx.message.create({
                data: {
                    leadId: leadId,
                    message: `System: Lead assigned to a new counselor.`,
                    sender: 'System',
                    channel: 'System'
                }
            });

            await tx.leadAssignmentHistory.create({
                data: {
                    leadId,
                    assignedById: req.user?.id || null,
                    assignedToId: targetUserId,
                    previousOwnerId
                }
            });

            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_ASSIGNED',
                    module: 'leads',
                    details: `Lead ID ${leadId} manually assigned to User ID ${userId} by ${req.user?.name}`,
                    status: 'Success'
                }
            });

            return lead;
        });

        socketManager.events.leadUpdate(updatedLead);

        res.json({ success: true, data: updatedLead, message: 'Lead assigned successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────
// AUTO ASSIGN LEADS (Bulk — Round Robin)
// ─────────────────────────────────────────────────
exports.autoAssignLeads = async (req, res, next) => {
    try {
        // Get all unassigned leads
        const unassignedLeads = await prisma.lead.findMany({
            where: { assignedTo: null }
        });

        if (!unassignedLeads.length) {
            return res.json({ success: true, message: 'No unassigned leads found', data: [] });
        }

        const results = [];
        
        // Process unassigned leads sequentially in a transaction to maintain RR order
        await prisma.$transaction(async (tx) => {
            for (const lead of unassignedLeads) {
                const counselor = await getNextCounselor(tx, lead.team);
                if (counselor) {
                    const updated = await tx.lead.update({
                        where: { id: lead.id },
                        data: { assignedTo: counselor.id, stage: 'Assigned' }
                    });

                    await tx.leadAssignmentHistory.create({
                        data: {
                            leadId: lead.id,
                            assignedById: req.user?.id || null,
                            assignedToId: counselor.id,
                            previousOwnerId: null
                        }
                    });

                    results.push({ leadId: lead.id, assignedTo: counselor.id, counselorName: counselor.name });
                }
            }
        }, { timeout: 15000 });

        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'BULK_AUTO_ASSIGN',
                module: 'leads',
                details: `${results.length} leads auto-assigned via Round Robin`,
                status: 'Success'
            }
        }).catch(() => {});

        res.json({
            success: true,
            message: `${results.length} leads auto-assigned successfully`,
            data: results
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// EXPORT LEADS
// ─────────────────────────────────────────────────
exports.exportLeads = async (req, res, next) => {
    try {
        const role = req.user?.roleName || req.user?.role?.name || '';
        const where = req.leadScope || {};

        const leads = await prisma.lead.findMany({
            where,
            include: {
                assignedUser: { select: { name: true } },
                messages: { orderBy: { timestamp: 'desc' }, take: 1 },
                followups: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { createdAt: 'desc' }
        });

        const canExportAcademic = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(role.toUpperCase());

        let csvContent = 'ID,Name,Country,Phone,Email,Program,Stage,Priority,Source,Created At,Last Conversation Date,Next Follow-up Date,Assigned Counselor,Follow-up Note';
        if (canExportAcademic) {
            csvContent += ',Address,SSC GPA,SSC Year,HSC GPA,HSC Year,Bachelor CGPA,Bachelor Year,Background,IELTS,MOI';
        }
        csvContent += '\n';

        leads.forEach(l => {
            const lastConvDate = l.messages && l.messages.length > 0 ? new Date(l.messages[0].timestamp).toISOString() : '';
            const nextFollowUp = l.followUpDate ? new Date(l.followUpDate).toISOString() : '';
            const assignedCounselor = l.assignedUser ? l.assignedUser.name : 'Unassigned';
            const followUpNote = l.followups && l.followups.length > 0 ? l.followups[0].notes || '' : '';

            let row = [
                l.id,
                `"${l.name || ''}"`,
                `"${l.country || ''}"`,
                `"${l.phone || ''}"`,
                `"${l.email || ''}"`,
                `"${l.program || ''}"`,
                `"${l.stage || 'New'}"`,
                `"${l.priority || 'Medium'}"`,
                `"${l.source || 'Website'}"`,
                new Date(l.createdAt).toISOString(),
                `"${lastConvDate}"`,
                `"${nextFollowUp}"`,
                `"${assignedCounselor}"`,
                `"${followUpNote.replace(/"/g, '""')}"`
            ];

            if (canExportAcademic) {
                row.push(
                    `"${l.currentAddress || ''}"`,
                    `"${l.sscGpa || ''}"`,
                    `"${l.sscPassingYear || ''}"`,
                    `"${l.hscGpa || ''}"`,
                    `"${l.hscPassingYear || ''}"`,
                    `"${l.bachelorCgpa || ''}"`,
                    `"${l.bachelorPassingYear || ''}"`,
                    `"${l.academicBackground || ''}"`,
                    `"${l.ieltsScore || ''}"`,
                    `"${l.moi || ''}"`
                );
            }
            csvContent += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        next(error);
    }
};
