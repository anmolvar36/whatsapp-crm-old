const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

BigInt.prototype.toJSON = function () {
    return Number(this);
};

module.exports = prisma;
