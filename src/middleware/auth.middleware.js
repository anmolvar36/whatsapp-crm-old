const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// ─────────────────────────────────────────────────
// 1. TOKEN VERIFICATION
// ─────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                include: { role: true }
            });

            if (!user) {
                return res.status(401).json({ success: false, message: 'Not authorized, user not found', data: null });
            }

            if (user.status !== 'Active') {
                return res.status(401).json({ success: false, message: 'Your account is deactivated', data: null });
            }

            req.user = user;
            req.user.roleName = user.role?.name || '';
            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Not authorized, token failed', data: null });
        }
    } else {
        return res.status(401).json({ success: false, message: 'Not authorized, no token', data: null });
    }
};

// ─────────────────────────────────────────────────
// 2. ROLE GUARD — STRICT RBAC
// ─────────────────────────────────────────────────
const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.roleName || req.user?.role?.name || '';

        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Role not found.'
            });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required: [${allowedRoles.join(', ')}]. Your role: ${userRole}`
            });
        }

        next();
    };
};

// ─────────────────────────────────────────────────
// 3. PERMISSION CHECK — Module-Level Access
// ─────────────────────────────────────────────────
const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            const roleName = req.user?.roleName || req.user?.role?.name || '';

            // SuperAdmin has all access
            if (roleName === 'SUPER_ADMIN') return next();

            const permission = await prisma.rolePermission.findFirst({
                where: { roleId: req.user.roleId, module }
            });

            if (!permission) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied for module: ${module}`
                });
            }

            let hasAccess = false;
            if (action === 'view') hasAccess = permission.canView;
            if (action === 'edit') hasAccess = permission.canEdit;
            if (action === 'delete') hasAccess = permission.canDelete;

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: `Permission '${action}' denied for module: ${module}`
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

// ─────────────────────────────────────────────────
// 4. DATA SCOPE — Filter data by role visibility
// ─────────────────────────────────────────────────
/**
 * Adds scope filter to req based on role:
 * - COUNSELOR: only own leads
 * - TEAM_LEADER: only team leads
 * - MANAGER/ADMIN/SUPER_ADMIN: all leads
 */
const scopeLeads = (req, res, next) => {
    const role = req.user?.roleName || req.user?.role?.name || '';

    if (role === 'COUNSELOR') {
        req.leadScope = { assignedTo: req.user.id };
    } else if (role === 'TEAM_LEADER') {
        req.leadScope = { team: req.user.team };
    } else if (role === 'SUPPORT' || role === 'Customer Support') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        req.leadScope = {
            OR: [
                { assignedTo: null },
                ...(req.user.team && req.user.team !== 'General' ? [{ team: req.user.team }] : []),
                {
                    assignmentHistory: {
                        some: {
                            assignedById: req.user.id,
                            assignedAt: { gte: thirtyDaysAgo }
                        }
                    }
                }
            ]
        };
    } else {
        req.leadScope = {}; // Full access
    }

    next();
};

module.exports = { verifyToken, roleGuard, checkPermission, scopeLeads };
