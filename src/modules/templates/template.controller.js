const prisma = require('../../config/prisma');

// @desc    Get all templates
// @route   GET /api/templates
exports.getTemplates = async (req, res, next) => {
    try {
        const templates = await prisma.template.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, message: 'Templates retrieved successfully', data: templates });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new template
// @route   POST /api/templates
exports.addTemplate = async (req, res, next) => {
    try {
        const { name, type, duration, description, taskList, tasks } = req.body;

        // Convert multiline string taskList to array if needed, but in frontend it's sent directly or joined
        let parsedTasks = [];
        if (typeof taskList === 'string') {
            parsedTasks = taskList.split('\n').filter(t => t.trim() !== '');
        } else if (Array.isArray(taskList)) {
            parsedTasks = taskList;
        }

        const newTemplate = await prisma.template.create({
            data: {
                name,
                type: type || 'Daily',
                tasks: tasks ? parseInt(tasks) : parsedTasks.length,
                duration: duration || '1 hour',
                description: description || '',
                taskList: parsedTasks,
                createdBy: req.user ? req.user.name : 'System'
            }
        });

        res.status(201).json({ success: true, message: 'Template created successfully', data: newTemplate });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a template
// @route   PUT /api/templates/:id
exports.updateTemplate = async (req, res, next) => {
    try {
        const templateId = parseInt(req.params.id);
        const { name, type, duration, description, taskList, tasks } = req.body;

        const currentTemplate = await prisma.template.findUnique({
            where: { id: templateId }
        });

        if (!currentTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        let parsedTasks = currentTemplate.taskList;
        if (typeof taskList === 'string') {
            parsedTasks = taskList.split('\n').filter(t => t.trim() !== '');
        } else if (Array.isArray(taskList)) {
            parsedTasks = taskList;
        }

        const updatedTemplate = await prisma.template.update({
            where: { id: templateId },
            data: {
                name,
                type,
                duration,
                description,
                taskList: parsedTasks,
                tasks: tasks ? parseInt(tasks) : parsedTasks.length
            }
        });

        res.json({ success: true, message: 'Template updated successfully', data: updatedTemplate });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a template
// @route   DELETE /api/templates/:id
exports.deleteTemplate = async (req, res, next) => {
    try {
        const templateId = parseInt(req.params.id);

        const currentTemplate = await prisma.template.findUnique({
            where: { id: templateId }
        });

        if (!currentTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        await prisma.template.delete({
            where: { id: templateId }
        });

        res.json({ success: true, message: 'Template deleted successfully', data: null });
    } catch (error) {
        next(error);
    }
};
