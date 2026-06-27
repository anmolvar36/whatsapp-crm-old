const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const { generateAccessToken, generateRefreshToken } = require('../../utils/generateToken');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
    try {
        let { name, email, password, role, country, team, client, assignedChannels } = req.body;

        // Provide a default password if none is provided from the frontend
        if (!password) {
            password = 'password123';
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(`[Auth] Registering user: ${email}, role: ${role}`);

        // Map frontend role labels to DB role names
        const roleMap = {
            'Admin': 'ADMIN',
            'Manager': 'MANAGER',
            'Team Leader': 'TEAM_LEADER',
            'Counselor': 'COUNSELOR',
            'Customer Support': 'SUPPORT',
            'Support': 'SUPPORT',
            'MANAGER': 'MANAGER',
            'TEAM_LEADER': 'TEAM_LEADER',
            'COUNSELOR': 'COUNSELOR',
            'SUPPORT': 'SUPPORT'
        };
        const dbRoleName = roleMap[role] || (role ? role.toUpperCase().replace(' ', '_') : 'COUNSELOR');

        const roleEntity = await prisma.role.findUnique({
            where: { name: dbRoleName }
        });

        if (!roleEntity) {
            console.error(`[Auth] Registration failed: Role ${dbRoleName} not found`);
            return res.status(400).json({ success: false, message: `System Error: Role ${dbRoleName} not found. Please run database seed.` });
        }

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                roleId: roleEntity.id,
                country: country || 'India',
                team: team || 'General',
                client: client || 'Global Entity',
                assignedChannels: parseInt(assignedChannels) || 0
            },
            include: { role: true }
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                token: generateAccessToken(user.id)
            }
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ success: false, message: 'Account is deactivated' });
        }

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Store refresh token in database (optional but recommended for revocation)
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token: accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role?.name,
                    roleId: user.roleId,
                    status: user.status,
                    country: user.country,
                    team: user.team,
                    client: user.client,
                    assignedChannels: user.assignedChannels,
                    permissions: user.permissions,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { role: true }
        });

        if (user) {
            delete user.password;
            delete user.refreshToken;
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.role) {
            user.role = user.role.name;
        }

        res.json({
            success: true,
            message: 'User profile fetched successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};
// @desc    Refresh access token
// @route   POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'crm_refresh_secret_2026');
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        // Find user and check if token matches
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token session' });
        }

        // Generate new access token
        const accessToken = generateAccessToken(user.id);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reset password (Mock sending email or reset)
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Simulating sending a password reset link
        res.json({
            success: true,
            message: 'Password reset link sent to your email.'
        });
    } catch (error) {
        next(error);
    }
};
