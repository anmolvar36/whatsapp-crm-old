const jwt = require('jsonwebtoken');

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '1h'
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'crm_refresh_secret_2026', {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    });
};

module.exports = { generateAccessToken, generateRefreshToken };
