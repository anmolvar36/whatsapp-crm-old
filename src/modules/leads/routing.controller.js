const prisma = require('../../config/prisma');
const { exportAll } = require('../../../scripts/export_db');

// @desc    Get all routing rules
// @route   GET /api/routing
exports.getRules = async (req, res, next) => {
    try {
        const rules = await prisma.routingRule.findMany({
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'desc' }
            ]
        });
        await exportAll();
        res.json({ success: true, data: rules });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new routing rule
// @route   POST /api/routing
exports.addRule = async (req, res, next) => {
    try {
        const { name, team, country, type, priority, counselor } = req.body;
        const newRule = await prisma.routingRule.create({
            data: {
                name: name || `${country} - ${team}`,
                team,
                country,
                counselor,
                type: type ? type.replace(/\s+/g, '_') : 'Round_Robin',
                priority: parseInt(priority) || 1,
                status: 'Active'
            }
        });
        res.status(201).json({ success: true, data: newRule });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle rule status
// @route   PUT /api/routing/:id/toggle
exports.toggleRule = async (req, res, next) => {
    try {
        const ruleId = parseInt(req.params.id);
        const rule = await prisma.routingRule.findUnique({
            where: { id: ruleId },
            select: { status: true }
        });

        if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

        const newStatus = rule.status === 'Active' ? 'Paused' : 'Active';
        await prisma.routingRule.update({
            where: { id: ruleId },
            data: { status: newStatus }
        });
        await exportAll();
        res.json({ success: true, status: newStatus });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete rule
// @route   DELETE /api/routing/:id
exports.deleteRule = async (req, res, next) => {
    try {
        const ruleId = parseInt(req.params.id);
        await prisma.routingRule.delete({
            where: { id: ruleId }
        });
        await exportAll();
        res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Rule not found' });
        }
        next(error);
    }
};

// @desc    Update rule
// @route   PUT /api/routing/:id
exports.updateRule = async (req, res, next) => {
    try {
        const ruleId = parseInt(req.params.id);
        const { name, team, country, type, priority, counselor } = req.body;

        const updatedRule = await prisma.routingRule.update({
            where: { id: ruleId },
            data: {
                name: name || `${country} - ${team}`,
                team,
                country,
                counselor,
                type: type ? type.replace(/\s+/g, '_') : 'Round_Robin',
                priority: priority ? parseInt(priority) : undefined
            }
        });

        await exportAll();
        res.json({ success: true, data: updatedRule });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Rule not found' });
        }
        next(error);
    }
};
