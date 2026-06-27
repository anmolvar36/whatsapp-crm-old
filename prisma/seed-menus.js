const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Menus...');

    // Mapping role names to IDs based on the provided SQL dump
    const roleIdMap = {
        'SUPER_ADMIN': 7,
        'ADMIN': 8,
        'MANAGER': 9,
        'TEAM_LEADER': 10,
        'COUNSELOR': 11,
        'SUPPORT': 12
    };

    // Verify roles exist first or find them by name
    const dbRoles = await prisma.role.findMany();
    const actualRoleIdMap = {};
    dbRoles.forEach(r => {
        actualRoleIdMap[r.name] = r.id;
    });

    const getRoleId = (name) => actualRoleIdMap[name] || roleIdMap[name];

    const menus = [
        // SUPER_ADMIN (Id: 7)
        { label: 'Overview', icon: 'LayoutDashboard', path: '/super-admin', roleId: getRoleId('SUPER_ADMIN'), order: 1 },
        { label: 'All Channels', icon: 'MessageSquare', path: '/super-admin/channels', roleId: getRoleId('SUPER_ADMIN'), order: 2 },
        { label: 'Global Users', icon: 'Users', path: '/super-admin/users', roleId: getRoleId('SUPER_ADMIN'), order: 3 },
        { label: 'Admin Management', icon: 'UserPlus', path: '/super-admin/admins', roleId: getRoleId('SUPER_ADMIN'), order: 4 },
        { label: 'Billing & Plans', icon: 'CreditCard', path: '/super-admin/billing', roleId: getRoleId('SUPER_ADMIN'), order: 5 },
        { label: 'System Analytics', icon: 'BarChart3', path: '/super-admin/analytics', roleId: getRoleId('SUPER_ADMIN'), order: 6 },
        { label: 'Audit Logs', icon: 'ScrollText', path: '/super-admin/audit', roleId: getRoleId('SUPER_ADMIN'), order: 7 },
        { label: 'Security', icon: 'ShieldCheck', path: '/super-admin/security', roleId: getRoleId('SUPER_ADMIN'), order: 8 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: getRoleId('SUPER_ADMIN'), order: 9 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: getRoleId('SUPER_ADMIN'), order: 10 },

        // ADMIN (Id: 8)
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/admin', roleId: getRoleId('ADMIN'), order: 1 },
        { label: 'Channel Setup', icon: 'MessageSquare', path: '/admin/channels', roleId: getRoleId('ADMIN'), order: 2 },
        { label: 'Routing Rules', icon: 'Globe', path: '/admin/routing', roleId: getRoleId('ADMIN'), order: 3 },
        { label: 'User Management', icon: 'Users', path: '/admin/users', roleId: getRoleId('ADMIN'), order: 4 },
        { label: 'AI Config', icon: 'BrainCircuit', path: '/admin/ai-config', roleId: getRoleId('ADMIN'), order: 5 },
        { label: 'Working Hours', icon: 'Clock', path: '/admin/working-hours', roleId: getRoleId('ADMIN'), order: 6 },
        { label: 'CRM Integration', icon: 'Link2', path: '/admin/crm-settings', roleId: getRoleId('ADMIN'), order: 7 },
        { label: 'Templates', icon: 'FileText', path: '/admin/templates', roleId: getRoleId('ADMIN'), order: 8 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: getRoleId('ADMIN'), order: 9 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: getRoleId('ADMIN'), order: 10 },

        // MANAGER (Id: 9)
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/manager', roleId: getRoleId('MANAGER'), order: 1 },
        { label: 'Lead Funnel', icon: 'PieChart', path: '/manager/funnel', roleId: getRoleId('MANAGER'), order: 2 },
        { label: 'Country Analysis', icon: 'Globe', path: '/manager/country', roleId: getRoleId('MANAGER'), order: 3 },
        { label: 'SLA Metrics', icon: 'TrendingUp', path: '/manager/sla', roleId: getRoleId('MANAGER'), order: 4 },
        { label: 'Conversion', icon: 'Activity', path: '/manager/conversion', roleId: getRoleId('MANAGER'), order: 5 },
        { label: 'Team Overview', icon: 'Users2', path: '/manager/team', roleId: getRoleId('MANAGER'), order: 6 },
        { label: 'Call Reports', icon: 'PhoneCall', path: '/manager/calls', roleId: getRoleId('MANAGER'), order: 7 },
        { label: 'Leads', icon: 'Users', path: '/leads', roleId: getRoleId('MANAGER'), order: 8 },

        // TEAM_LEADER (Id: 10)
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/team-leader', roleId: getRoleId('TEAM_LEADER'), order: 1 },
        { label: 'Team Inbox', icon: 'Inbox', path: '/team-leader/inbox', roleId: getRoleId('TEAM_LEADER'), order: 2 },
        { label: 'Assigned Leads', icon: 'Users', path: '/team-leader/leads', roleId: getRoleId('TEAM_LEADER'), order: 3 },
        { label: 'Performance', icon: 'UserCheck', path: '/team-leader/performance', roleId: getRoleId('TEAM_LEADER'), order: 4 },
        { label: 'Reassign Leads', icon: 'RefreshCcw', path: '/team-leader/reassign', roleId: getRoleId('TEAM_LEADER'), order: 5 },
        { label: 'SLA Alerts', icon: 'AlertTriangle', path: '/team-leader/sla', roleId: getRoleId('TEAM_LEADER'), order: 6 },
        { label: 'Activity Logs', icon: 'FileText', path: '/team-leader/logs', roleId: getRoleId('TEAM_LEADER'), order: 7 },

        // COUNSELOR (Id: 11)
        { label: 'My Dashboard', icon: 'LayoutDashboard', path: '/counselor', roleId: getRoleId('COUNSELOR'), order: 1 },
        { label: 'My Leads', icon: 'Target', path: '/leads', roleId: getRoleId('COUNSELOR'), order: 2 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: getRoleId('COUNSELOR'), order: 3 },
        { label: 'Lead Stages', icon: 'Layers', path: '/counselor/stages', roleId: getRoleId('COUNSELOR'), order: 4 },
        { label: 'Lead Notes', icon: 'FileEdit', path: '/counselor/notes', roleId: getRoleId('COUNSELOR'), order: 5 },
        { label: 'AI Summary', icon: 'Sparkles', path: '/counselor/ai-summary', roleId: getRoleId('COUNSELOR'), order: 6 },
        { label: 'Call History', icon: 'Phone', path: '/counselor/calls', roleId: getRoleId('COUNSELOR'), order: 7 },

        // SUPPORT (Id: 12)
        { label: 'Support Dash', icon: 'LayoutDashboard', path: '/support', roleId: getRoleId('SUPPORT'), order: 1 },
        { label: 'Lead Assignment', icon: 'UserCheck', path: '/support/assign', roleId: getRoleId('SUPPORT'), order: 2 },
        { label: 'AI Status', icon: 'Zap', path: '/support/ai-status', roleId: getRoleId('SUPPORT'), order: 3 },
        { label: 'Templates', icon: 'FileText', path: '/support/templates', roleId: getRoleId('SUPPORT'), order: 4 },
        { label: 'Inbox', icon: 'Inbox', path: '/inbox', roleId: getRoleId('SUPPORT'), order: 5 }
    ];

    for (const menu of menus) {
        if (!menu.roleId) {
            console.log(`⚠️ Skipping menu "${menu.label}" - Role not found`);
            continue;
        }
        await prisma.menu.upsert({
            where: { id: -1 }, // Use a non-existent ID to force creation if not found, or use a better unique constraint if available
            // Note: menu table doesn't have a unique constraint on label+roleId in the Prisma schema probably, 
            // so we'll just use create or find/create logic.
            create: menu,
            update: menu,
            // Since we don't have a unique ID for upsert here that matches our logic, let's just create if not exists
        });
    }

    // Better approach: clear and re-insert JUST the menus
    await prisma.menu.deleteMany();
    await prisma.menu.createMany({ data: menus });

    console.log('✅ Menus seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
