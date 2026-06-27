const prisma = require('../../config/prisma');

/**
 * AI Lead Scoring System
 *
 * Scores leads as:
 * - HOT (70-100): High engagement, complete profile, premium program
 * - WARM (40-69): Medium engagement
 * - COLD (0-39): Low engagement, incomplete profile
 *
 * Also provides: Auto-tagging based on profile signals
 */

const WEIGHTS = {
    hasEmail: 10,
    hasPhone: 15,
    hasCountry: 5,
    hasProgram: 15,
    priorityHigh: 20,
    priorityMedium: 10,
    stageAdvanced: 20,   // Qualified/In Progress stages
    followUpSet: 10,
    hasNotes: 5          // Engagement signal
};

/**
 * Calculate AI Score for a lead - PRODUCTION GRADE DETERMINISTIC LOGIC
 */
const calculateLeadScore = (lead) => {
    let score = 0;
    const tags = [];

    // 1. Data Completeness
    if (lead.email) { score += WEIGHTS.hasEmail; tags.push('Verified Email'); }
    if (lead.phone) { score += WEIGHTS.hasPhone; tags.push('Mobile Linked'); }
    if (lead.country) { score += WEIGHTS.hasCountry; }
    if (lead.program && lead.program !== 'General') { score += WEIGHTS.hasProgram; tags.push(`Target: ${lead.program}`); }
    
    // 2. Intent Signals
    if (lead.priority === 'High') { score += WEIGHTS.priorityHigh; tags.push('Urgent Intent'); }
    else if (lead.priority === 'Medium') { score += WEIGHTS.priorityMedium; }
    
    if (['Qualified', 'In Progress', 'Enrolled'].includes(lead.stage)) {
        score += WEIGHTS.stageAdvanced;
        tags.push('Active Pipeline');
    }
    
    // 3. Engagement Signals
    if (lead.followUpDate) { score += WEIGHTS.followUpSet; tags.push('Nurture Scheduled'); }
    if (lead.counselorNotes && lead.counselorNotes.length > 0) { score += WEIGHTS.hasNotes; tags.push('Counselor Engaged'); }

    // Normalize to 100
    const finalScore = Math.min(score, 100);

    // Classification (Deterministic)
    let classification = 'COLD';
    if (finalScore >= 80) classification = 'HOT';
    else if (finalScore >= 40) classification = 'WARM';

    return { score: finalScore, classification, tags };
};

/**
 * Score a single lead (Controller)
 */
exports.scoreLead = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        const { score, classification, tags } = calculateLeadScore(lead);

        // Update lead score in DB
        await prisma.lead.update({
            where: { id: leadId },
            data: { score }
        });

        res.json({
            success: true,
            message: 'AI Lead Score calculated',
            data: {
                leadId,
                leadName: lead.name,
                score,
                classification,
                tags,
                recommendation: getRecommendation(classification)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Score ALL leads in bulk
 */
exports.scoreAllLeads = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany();
        const results = [];

        for (const lead of leads) {
            const { score, classification, tags } = calculateLeadScore(lead);
            await prisma.lead.update({ where: { id: lead.id }, data: { score } });
            results.push({ leadId: lead.id, name: lead.name, score, classification });
        }

        const hot = results.filter(r => r.classification === 'HOT').length;
        const warm = results.filter(r => r.classification === 'WARM').length;
        const cold = results.filter(r => r.classification === 'COLD').length;

        res.json({
            success: true,
            message: `AI Scoring complete for ${results.length} leads`,
            data: {
                summary: { hot, warm, cold, total: results.length },
                results
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Smart Reply Suggestions based on lead stage
 */
exports.getSmartReplies = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        const suggestions = getSmartReplySuggestions(lead.stage, lead.name);

        res.json({
            success: true,
            data: { leadId, stage: lead.stage, suggestions }
        });
    } catch (error) {
        next(error);
    }
};

// ─── Helpers ──────────────────────────────────────

const getRecommendation = (classification) => {
    if (classification === 'HOT') return 'Contact immediately. High conversion potential.';
    if (classification === 'WARM') return 'Follow up within 24 hours. Nurture with relevant content.';
    return 'Add to drip campaign. Build engagement before direct outreach.';
};

const getSmartReplySuggestions = (stage, name) => {
    const n = name || 'there';
    const templates = {
        'New': [
            `Hi ${n}! Thanks for reaching out. How can I help you today?`,
            `Hello ${n}! I'm excited to assist you. Could you share more about what you're looking for?`,
            `Welcome ${n}! Let me know how I can support you.`
        ],
        'Assigned': [
            `Hi ${n}, I've been assigned to your case. Let's connect!`,
            `Hello ${n}! I'll be your dedicated counselor. When's a good time to talk?`
        ],
        'Follow Up': [
            `Hi ${n}, just following up on our previous conversation. Any questions?`,
            `Hello ${n}! Hope you had time to think things over. Ready to move forward?`
        ],
        'Qualified': [
            `Great news ${n}! You qualify for our program. Let's discuss the next steps.`,
            `${n}, based on our discussion, I think this is a perfect fit for you!`
        ],
        'Default': [
            `Hi ${n}, how can I assist you today?`,
            `Hello ${n}! Feel free to ask me anything.`
        ]
    };
    return templates[stage] || templates['Default'];
};
