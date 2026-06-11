const { PrismaClient } = require('@prisma/client');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const prisma = new PrismaClient();

async function mfaRoutes(fastify) {
  // POST /api/auth/mfa/setup
  fastify.post('/setup', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Generate a temporary secret
    const secret = speakeasy.generateSecret({
      name: `IWMS:${user.email}`,
    });

    // Generate QR code data URL
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return reply.send({
      secret: secret.base32,
      qrCodeUrl,
    });
  });

  // POST /api/auth/mfa/enable
  fastify.post('/enable', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { secret, token } = request.body || {};

    if (!secret || !token) {
      return reply.code(400).send({ error: 'secret and token are required' });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      return reply.code(400).send({ error: 'Invalid verification code. Please try again.' });
    }

    await prisma.user.update({
      where: { id: request.user.sub },
      data: {
        mfaEnabled: true,
        mfaSecret: secret,
      },
    });

    return reply.send({ success: true, message: 'MFA enabled successfully' });
  });

  // POST /api/auth/mfa/disable
  fastify.post('/disable', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { token } = request.body || {};

    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.mfaEnabled && !token) {
      return reply.code(400).send({ error: 'Verification token is required to disable MFA' });
    }

    if (user.mfaEnabled) {
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!verified) {
        return reply.code(400).send({ error: 'Invalid verification code.' });
      }
    }

    await prisma.user.update({
      where: { id: request.user.sub },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    return reply.send({ success: true, message: 'MFA disabled successfully' });
  });
}

module.exports = mfaRoutes;
