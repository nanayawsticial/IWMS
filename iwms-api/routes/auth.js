const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getSecret } = require('../lib/runtime');

const prisma = new PrismaClient();
const refreshSecret = () => getSecret('JWT_REFRESH_SECRET', 'refresh-secret');

// Role permission map (mirrors frontend auth-context.tsx)
const ROLE_PERMISSIONS = {
  super_admin: ['view_all_dashboards','manage_users','assign_tasks','approve_overtime','view_biometric_data','export_reports','configure_hardware','system_settings','edit_attendance','view_own_data'],
  admin:       ['view_all_dashboards','manage_users','assign_tasks','approve_overtime','view_biometric_data','export_reports','configure_hardware','system_settings','edit_attendance','view_own_data'],
  hr_manager:  ['view_all_dashboards','manage_users','approve_overtime','view_biometric_data','export_reports','edit_attendance','view_own_data'],
  manager:     ['view_all_dashboards','assign_tasks','approve_overtime','view_biometric_data','export_reports','view_own_data'],
  team_lead:   ['assign_tasks','view_own_data'],
  employee:    ['view_own_data'],
};

function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

async function authRoutes(fastify) {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { department: true },
    });

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'Account is inactive' });
    }

    if (user.mfaEnabled) {
      const tempToken = fastify.jwt.sign(
        { sub: user.id, email: user.email, temp: true },
        { expiresIn: '5m' }
      );
      return reply.send({ mfaRequired: true, tempToken });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d', secret: refreshSecret() }
    );

    // Store refresh token in DB
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash, mfaSecret, ...safeUser } = user;
    return reply.send({
      accessToken,
      refreshToken,
      user: {
        ...safeUser,
        department: user.department?.name || '',
        permissions: ROLE_PERMISSIONS[user.role] || [],
      },
    });
  });

  // POST /api/auth/login/mfa
  fastify.post('/login/mfa', async (request, reply) => {
    const { tempToken, code } = request.body || {};
    if (!tempToken || !code) {
      return reply.code(400).send({ error: 'tempToken and code are required' });
    }

    let decoded;
    try {
      decoded = fastify.jwt.verify(tempToken);
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired temporary session' });
    }

    if (!decoded.temp) {
      return reply.code(401).send({ error: 'Invalid session type' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { department: true },
    });

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'Account is inactive' });
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return reply.code(400).send({ error: 'MFA is not enabled for this user' });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return reply.code(401).send({ error: 'Invalid verification code' });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d', secret: refreshSecret() }
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
    return reply.send({
      accessToken,
      refreshToken,
      user: {
        ...safeUser,
        department: user.department?.name || '',
        permissions: ROLE_PERMISSIONS[user.role] || [],
      },
    });
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = fastify.jwt.verify(refreshToken, {
        secret: refreshSecret(),
      });
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'Session expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' }
    );

    return reply.send({ accessToken });
  });

  // POST /api/auth/logout
  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
    return reply.send({ message: 'Logged out successfully' });
  });

  // GET /api/auth/me
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { department: true },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const { passwordHash, ...safeUser } = user;
    return reply.send({
      ...safeUser,
      department: user.department?.name || '',
      permissions: ROLE_PERMISSIONS[user.role] || [],
    });
  });
}

module.exports = authRoutes;
