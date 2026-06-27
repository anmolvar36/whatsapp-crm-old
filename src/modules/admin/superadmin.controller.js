const prisma = require('../../config/prisma');

// @desc    Toggle client channel status
// @route   PUT /api/super-admin/channels/:id/toggle
exports.toggleClientChannel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const channelId = parseInt(id);
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { status: true }
        });

        if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

        const newStatus = channel.status === 'Active' ? 'Inactive' : 'Active';
        await prisma.channel.update({
            where: { id: channelId },
            data: { status: newStatus }
        });
        res.json({ success: true, message: 'Client channel status updated' });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete client channel
// @route   DELETE /api/super-admin/channels/:id
exports.deleteClientChannel = async (req, res, next) => {
    try {
        const channelId = parseInt(req.params.id);
        await prisma.channel.delete({
            where: { id: channelId }
        });
        res.json({ success: true, message: 'Client channel removed' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }
        next(error);
    }
};

// @desc    Dispatch lead from global queue
// @route   POST /api/super-admin/leads/dispatch
exports.dispatchLead = async (req, res, next) => {
    try {
        const { leadId, counselorId } = req.body;
        await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { assignedTo: parseInt(counselorId) }
        });
        res.json({ success: true, message: 'Lead dispatched successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new admin
// @route   POST /api/super-admin/admins
exports.addAdmin = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const bcrypt = require('bcryptjs');

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const passwordToHash = password || 'welcome123';
        const hashedPassword = await bcrypt.hash(passwordToHash, 10);

        let dbRoleName = 'ADMIN';
        if (req.body.role === 'System Admin') dbRoleName = 'SUPER_ADMIN';
        else if (req.body.role === 'Regional Admin') dbRoleName = 'ADMIN';

        const roleRecord = await prisma.role.findUnique({ where: { name: dbRoleName } });
        if (!roleRecord) {
            return res.status(400).json({ success: false, message: `Role ${dbRoleName} not found in system` });
        }

        const newAdmin = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                roleId: roleRecord.id,
                client: req.body.client || 'EduCorp Inc.',
                permissions: req.body.permissions || ['Users', 'Analytics']
            }
        });

        res.status(201).json({
            success: true,
            message: 'New administrator added',
            data: { id: newAdmin.id, name: newAdmin.name, email: newAdmin.email }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update admin permissions
// @route   PUT /api/super-admin/admins/:id/permissions
exports.updatePermissions = async (req, res, next) => {
    try {
        const adminId = parseInt(req.params.id);
        const { permissions } = req.body; // Array of strings

        const updated = await prisma.user.update({
            where: { id: adminId },
            data: { permissions }
        });

        res.json({ success: true, message: 'Administrative permissions synchronized', data: updated });
    } catch (error) {
        next(error);
    }
};
// @desc    Get all admins
// @route   GET /api/super-admin/admins
exports.getAdmins = async (req, res, next) => {
    try {
        // Fetch all users with roles and filter admin-level roles safely
        const allUsers = await prisma.user.findMany({
            include: { role: true },
            orderBy: { createdAt: 'desc' }
        });

        const admins = allUsers.filter(u => {
            const roleStr = typeof u.role === 'object' ? (u.role?.name || '') : (u.role || '');
            return ['ADMIN', 'SUPER_ADMIN'].includes(roleStr.toUpperCase());
        });

        const enrichedAdmins = admins.map(admin => ({
            ...admin,
            role: typeof admin.role === 'object' ? (admin.role?.name || 'Admin') : (admin.role || 'Admin'),
            login: admin.createdAt,
            client: admin.client || 'Global Entity',
            permissions: Array.isArray(admin.permissions) ? admin.permissions : ['Users', 'Analytics']
        }));

        res.json({ success: true, data: enrichedAdmins });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle admin account status
// @route   PUT /api/super-admin/admins/:id/toggle
exports.toggleAdminStatus = async (req, res, next) => {
    try {
        const adminId = parseInt(req.params.id);
        const user = await prisma.user.findUnique({
            where: { id: adminId },
            select: { status: true }
        });

        if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });

        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        await prisma.user.update({
            where: { id: adminId },
            data: { status: newStatus }
        });

        res.json({ success: true, message: `Admin status set to ${newStatus}` });
    } catch (error) {
        next(error);
    }
};
// @desc    Get Super Admin Dashboard KPIs
// @route   GET /api/super-admin/dashboard/kpis
exports.getDashboardKpis = async (req, res, next) => {
    try {
        const { country, status, dateRange } = req.query;

        const leadWhere = {};
        if (country && country !== 'Global') leadWhere.country = country;
        if (status && status !== 'All Stages') {
            const map = { 'Hot Priority': 'HOT', 'Warm Inbound': 'WARM', 'Cold Prospect': 'COLD' };
            if (map[status] === 'HOT') leadWhere.score = { gt: 80 };
            else if (map[status] === 'WARM') leadWhere.score = { gt: 50 };
            else if (map[status] === 'COLD') leadWhere.score = { lte: 50 };
        }

        const [totalClients, totalLeads, activeChannels] = await Promise.all([
            prisma.subscription.count(),
            prisma.lead.count({ where: leadWhere }),
            prisma.channel.count({ where: { status: 'Active' } })
        ]);

        res.json({
            success: true,
            data: {
                totalClients,
                totalLeads,
                totalRevenue: totalClients * 499,
                activeChannels
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get leads for dispatch queue
// @route   GET /api/super-admin/leads/dispatch-queue
exports.getDispatchQueue = async (req, res, next) => {
    try {
        const { country, status } = req.query;
        const where = { assignedTo: null };

        if (country && country !== 'Global') {
            where.country = country;
        }

        if (status && status !== 'All Stages') {
            const map = { 'Hot Priority': 'HOT', 'Warm Inbound': 'WARM', 'Cold Prospect': 'COLD' };
            if (map[status] === 'HOT') where.score = { gt: 80 };
            else if (map[status] === 'WARM') where.score = { gt: 50 };
            else if (map[status] === 'COLD') where.score = { lte: 50 };
        }

        const leads = await prisma.lead.findMany({
            where,
            take: 10
        });

        const formattedLeads = leads.map(l => ({
            ...l,
            status: l.stage,
            score: l.score || 85,
            assignedTo: 'PENDING'
        }));

        res.json({ success: true, data: formattedLeads });
    } catch (error) {
        next(error);
    }
};
