const prisma = require('../lib/prisma');

async function organizationRoutes(fastify) {
  // GET /api/organization
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    return reply.send({
      id: org.id,
      name: org.name,
      joinCode: org.joinCode,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    });
  });

  // POST /api/organization/regenerate-code
  fastify.post('/regenerate-code', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const crypto = require('crypto');
      let newJoinCode;
      let isUnique = false;

      while (!isUnique) {
        newJoinCode = `ORG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const existing = await prisma.organization.findUnique({
          where: { joinCode: newJoinCode }
        });
        if (!existing) isUnique = true;
      }

      const updated = await prisma.organization.update({
        where: { id: organizationId },
        data: { joinCode: newJoinCode }
      });

      return reply.send({
        success: true,
        joinCode: updated.joinCode,
        message: 'Organization invite code regenerated successfully'
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to regenerate join code' });
    }
  });

  // PATCH /api/organization
  fastify.patch('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name } = request.body || {};
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Organization name is required' });
    }

    const cleanName = name.trim();

    try {
      // Check if name is taken by another organization
      const existing = await prisma.organization.findFirst({
        where: { name: cleanName, NOT: { id: organizationId } }
      });
      if (existing) {
        return reply.code(400).send({ error: 'Organization name is already taken' });
      }

      const updated = await prisma.organization.update({
        where: { id: organizationId },
        data: { name: cleanName }
      });

      return reply.send({
        id: updated.id,
        name: updated.name,
        joinCode: updated.joinCode,
        updatedAt: updated.updatedAt
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to update organization' });
    }
  });
}

module.exports = organizationRoutes;
