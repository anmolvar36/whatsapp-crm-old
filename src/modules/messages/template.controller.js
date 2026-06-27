const prisma = require('../../config/prisma');

// @desc    Get all templates
// @route   GET /api/templates
exports.getTemplates = async (req, res, next) => {
    try {
        const templates = await prisma.messageTemplate.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({ success: true, data: templates });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new template
// @route   POST /api/templates
exports.addTemplate = async (req, res, next) => {
    try {
        const { name, content, category } = req.body;
        const newTemplate = await prisma.messageTemplate.create({
            data: {
                name,
                content,
                category,
                createdBy: req.user.id
            }
        });
        res.status(201).json({ success: true, data: newTemplate });
    } catch (error) {
        next(error);
    }
};

// @desc    Update template
// @route   PUT /api/templates/:id
exports.updateTemplate = async (req, res, next) => {
    try {
        const { name, content, category } = req.body;
        const templateId = parseInt(req.params.id);

        const updatedTemplate = await prisma.messageTemplate.update({
            where: { id: templateId },
            data: {
                name,
                content,
                category
            }
        });
        res.json({ success: true, data: updatedTemplate });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete template
// @route   DELETE /api/templates/:id
exports.deleteTemplate = async (req, res, next) => {
    try {
        const templateId = parseInt(req.params.id);
        await prisma.messageTemplate.delete({
            where: { id: templateId }
        });
        res.json({ success: true, message: 'Template removed' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        next(error);
    }
};
