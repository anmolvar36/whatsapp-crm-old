const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const { exportAll } = require('../../../scripts/export_db');

// @desc    Get all users
// @route   GET /api/users
exports.getUsers = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            include: { role: true },
            orderBy: { createdAt: 'desc' }
        });

        const data = users.map(user => ({
            ...user,
            role: user.role?.name || 'N/A'
        }));

        res.json({ success: true, message: 'Users retrieved successfully', data });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user status/role
// @route   PUT /api/users/:id
exports.updateUser = async (req, res, next) => {
    try {
        const { name, email, role, country, team, password, status, assignedChannels } = req.body;
        const userId = parseInt(req.params.id);

        let updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (country) updateData.country = country;
        if (team) updateData.team = team;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        if (role) {
            const roleMap = {
                'Manager': 'MANAGER',
                'Team Leader': 'TEAM_LEADER',
                'Counselor': 'COUNSELOR',
                'Customer Support': 'SUPPORT'
            };
            const dbRoleName = roleMap[role] || role;
            const roleRecord = await prisma.role.findUnique({ where: { name: dbRoleName } });
            if (roleRecord) {
                updateData.roleId = roleRecord.id;
            }
        }

        if (assignedChannels !== undefined) updateData.assignedChannels = parseInt(assignedChannels);

        if (status) {
            if (status === 'TOGGLE') {
                const currentUser = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { status: true }
                });
                updateData.status = currentUser.status === 'Active' ? 'Inactive' : 'Active';
            } else {
                updateData.status = status;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: { role: true }
        });

        const data = {
            ...updatedUser,
            role: updatedUser.role?.name || 'N/A'
        };

        res.json({
            success: true,
            message: 'User updated successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle user status
// @route   PUT /api/users/:id/toggle
exports.toggleUserStatus = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true }
        });

        if (!currentUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newStatus = currentUser.status === 'Active' ? 'Inactive' : 'Active';

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { status: newStatus },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true
            }
        });

        res.json({
            success: true,
            message: `User status changed to ${newStatus}`,
            data: updatedUser
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);

        const currentUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!currentUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({ success: true, message: 'User deleted successfully', data: null });
    } catch (error) {
        next(error);
    }
};
