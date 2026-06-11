// Shared Prisma client singleton.
// IMPORTANT: dns.setDefaultResultOrder('verbatim') must be called BEFORE
// PrismaClient is imported, so Node.js resolves IPv6-only hostnames (Supabase
// direct DB). This module is always imported AFTER server.js sets the order.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
