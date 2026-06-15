const prisma = require('../lib/prisma');

async function departmentsRoutes(fastify) {
  // GET /api/departments
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const departments = await prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return reply.send(departments);
  });

  // POST /api/departments
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, color, managerId, managerName } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'Department name is required' });

    const dept = await prisma.department.create({
      data: { name, color: color || '#6366f1', managerId, managerName: managerName || '', organizationId },
    });
    return reply.code(201).send(dept);
  });

  // PATCH /api/departments/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, color, managerId, managerName, headcount } = request.body || {};
    try {
      const existing = await prisma.department.findFirst({
        where: { id: request.params.id, organizationId }
      });
      if (!existing) {
        return reply.code(404).send({ error: 'Department not found' });
      }

      const dept = await prisma.department.update({
        where: { id: request.params.id },
        data: { name, color, managerId, managerName, headcount },
      });
      return reply.send(dept);
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Department not found' });
      }
      throw err;
    }
  });
}

module.exports = departmentsRoutes;
