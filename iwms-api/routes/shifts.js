const prisma = require('../lib/prisma');

async function shiftsRoutes(fastify) {
  // GET /api/shifts
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { startDate, endDate, departmentId, userId } = request.query || {};

    const where = { organizationId };
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    }

    if (userId) {
      where.userId = userId;
    }

    if (departmentId) {
      where.user = { departmentId: departmentId };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: {
          include: { department: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    return reply.send(shifts.map(s => ({
      id: s.id,
      userId: s.userId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      type: s.type,
      notes: s.notes,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      userName: s.user.name,
      userEmail: s.user.email,
      department: s.user.department?.name || ''
    })));
  });

  // POST /api/shifts
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin', 'manager', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions to assign shifts' });
    }

    const { userId, date, type, startTime, endTime, notes } = request.body || {};

    if (!userId || !date || !type) {
      return reply.code(400).send({ error: 'userId, date, and type are required' });
    }

    const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const shift = await prisma.shift.upsert({
      where: { userId_date: { userId, date } },
      update: {
        type,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: notes || '',
        organizationId
      },
      create: {
        userId,
        date,
        type,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: notes || '',
        organizationId
      },
      include: { user: true }
    });

    if (global.io) {
      global.io.emit('shift:updated', {
        userId: shift.userId,
        date: shift.date,
        type: shift.type
      });
    }

    return reply.send(shift);
  });
}

module.exports = shiftsRoutes;
