const prisma = require('../lib/prisma');

async function holidaysRoutes(fastify) {
  // GET /api/holidays
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { year } = request.query || {};

    const where = { organizationId };
    if (year) {
      where.date = {
        startsWith: year
      };
    }

    const holidays = await prisma.publicHoliday.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    return reply.send(holidays);
  });

  // POST /api/holidays
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;

    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, date, type } = request.body || {};

    if (!name || !date) {
      return reply.code(400).send({ error: 'Holiday name and date are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.code(400).send({ error: 'Holiday date must be in YYYY-MM-DD format' });
    }

    // Check if holiday already exists on this date
    const existing = await prisma.publicHoliday.findUnique({
      where: {
        date_organizationId: {
          date,
          organizationId
        }
      }
    });

    if (existing) {
      return reply.code(400).send({ error: 'A public holiday is already registered on this date' });
    }

    const holiday = await prisma.publicHoliday.create({
      data: {
        name,
        date,
        type: type || 'public',
        organizationId
      }
    });

    // Notify via Socket.io if available
    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('holiday:created', holiday);
    }

    return reply.code(201).send(holiday);
  });

  // DELETE /api/holidays/:id
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    const { id } = request.params;

    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const existing = await prisma.publicHoliday.findFirst({
      where: { id, organizationId }
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Public holiday not found' });
    }

    await prisma.publicHoliday.delete({
      where: { id }
    });

    // Notify via Socket.io if available
    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('holiday:deleted', { id });
    }

    return reply.send({ success: true, message: 'Public holiday deleted successfully' });
  });
}

module.exports = holidaysRoutes;
