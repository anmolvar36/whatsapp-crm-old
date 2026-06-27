const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding menus...');

    // Clear existing menus
    await prisma.submenu.deleteMany();
    await prisma.menu.deleteMany();

    // Fetch roles to get IDs
    const roles = await prisma.role.findMany();
    const roleMap = roles.reduce((acc, role) => {
        acc[role.name] = role.id;
        return acc;
    }, {});

    const menus = [
        // SUPER_ADMIN
        { label: 'Overview', icon: 'LayoutDashboard', path: '/super-admin', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 1 },
        { label: 'All Channels', icon: 'MessageSquare', path: '/super-admin/channels', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 2 },
        { label: 'Global Users', icon: 'Users', path: '/super-admin/users', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 3 },
        { label: 'Admin Management', icon: 'UserPlus', path: '/super-admin/admins', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 4 },
        { label: 'Billing & Plans', icon: 'CreditCard', path: '/super-admin/billing', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 5 },
        { label: 'System Analytics', icon: 'BarChart3', path: '/super-admin/analytics', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 6 },
        { label: 'Audit Logs', icon: 'ScrollText', path: '/super-admin/audit', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 7 },
        { label: 'Security', icon: 'ShieldCheck', path: '/super-admin/security', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 8 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 9 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: roleMap['Super Admin'] || roleMap['SUPER_ADMIN'], order: 10 },

        // ADMIN
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/admin', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 1 },
        { label: 'Channel Setup', icon: 'MessageSquare', path: '/admin/channels', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 2 },
        { label: 'Routing Rules', icon: 'Globe', path: '/admin/routing', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 3 },
        { label: 'User Management', icon: 'Users', path: '/admin/users', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 4 },
        { label: 'AI Config', icon: 'BrainCircuit', path: '/admin/ai-config', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 5 },
        { label: 'Working Hours', icon: 'Clock', path: '/admin/working-hours', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 6 },
        { label: 'CRM Integration', icon: 'Link2', path: '/admin/crm-settings', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 7 },
        { label: 'Templates', icon: 'FileText', path: '/admin/templates', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 8 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 9 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: roleMap['Admin'] || roleMap['ADMIN'], order: 10 },

        // MANAGER
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/manager', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 1 },
        { label: 'Lead Funnel', icon: 'PieChart', path: '/manager/funnel', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 2 },
        { label: 'Country Analysis', icon: 'Globe', path: '/manager/country', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 3 },
        { label: 'SLA Metrics', icon: 'TrendingUp', path: '/manager/sla', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 4 },
        { label: 'Conversion', icon: 'Activity', path: '/manager/conversion', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 5 },
        { label: 'Team Overview', icon: 'Users2', path: '/manager/team', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 6 },
        { label: 'Call Reports', icon: 'PhoneCall', path: '/manager/calls', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 7 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: roleMap['Manager'] || roleMap['MANAGER'], order: 8 },

        // TEAM_LEADER
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/team-leader', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 1 },
        { label: 'Team Inbox', icon: 'Inbox', path: '/team-leader/inbox', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 2 },
        { label: 'Assigned Leads', icon: 'Users', path: '/team-leader/leads', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 3 },
        { label: 'Performance', icon: 'UserCheck', path: '/team-leader/performance', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 4 },
        { label: 'Reassign Leads', icon: 'RefreshCcw', path: '/team-leader/reassign', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 5 },
        { label: 'SLA Alerts', icon: 'AlertTriangle', path: '/team-leader/sla', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 6 },
        { label: 'Activity Logs', icon: 'FileText', path: '/team-leader/logs', roleId: roleMap['Team Leader'] || roleMap['TEAM_LEADER'], order: 7 },

        // COUNSELOR
        { label: 'My Dashboard', icon: 'LayoutDashboard', path: '/counselor', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 1 },
        { label: 'My Leads', icon: 'Target', path: '/leads', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 2 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 3 },
        { label: 'Lead Stages', icon: 'Layers', path: '/counselor/stages', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 4 },
        { label: 'Lead Notes', icon: 'FileEdit', path: '/counselor/notes', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 5 },
        { label: 'AI Summary', icon: 'Sparkles', path: '/counselor/ai-summary', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 6 },
        { label: 'Call History', icon: 'Phone', path: '/counselor/calls', roleId: roleMap['Counselor'] || roleMap['COUNSELOR'], order: 7 },

        // SUPPORT
        { label: 'Support Dash', icon: 'LayoutDashboard', path: '/support', roleId: roleMap['Customer Support'] || roleMap['SUPPORT'], order: 1 },
        { label: 'Lead Assignment', icon: 'UserCheck', path: '/support/assign', roleId: roleMap['Customer Support'] || roleMap['SUPPORT'], order: 2 },
        { label: 'AI Status', icon: 'Zap', path: '/support/ai-status', roleId: roleMap['Customer Support'] || roleMap['SUPPORT'], order: 3 },
        { label: 'Templates', icon: 'FileText', path: '/support/templates', roleId: roleMap['Customer Support'] || roleMap['SUPPORT'], order: 4 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: roleMap['Customer Support'] || roleMap['SUPPORT'], order: 5 }
    ];

    for (const menuData of menus) {
        await prisma.menu.create({
            data: menuData
        });
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
