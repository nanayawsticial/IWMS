const prisma = require('../lib/prisma');

async function overtimeRoutes(fastify) {
  // GET /api/overtime
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;

    let requests;
    if (['super_admin', 'admin', 'hr_manager', 'manager'].includes(role)) {
      requests = await prisma.overtimeRequest.findMany({
        where: { organizationId },
        include: { user: { select: { name: true, email: true, avatar: true, department: { select: { name: true } } } } },
        orderBy: { date: 'desc' }
      });
    } else {
      requests = await prisma.overtimeRequest.findMany({
        where: { userId: sub, organizationId },
        include: { user: { select: { name: true, email: true, avatar: true, department: { select: { name: true } } } } },
        orderBy: { date: 'desc' }
      });
    }

    return reply.send(requests.map(r => ({
      id: r.id,
      userId: r.userId,
      date: r.date,
      regularHours: r.regularHours,
      overtimeHours: r.overtimeHours,
      reason: r.reason,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewNotes: r.reviewNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userName: r.user.name,
      userEmail: r.user.email,
      userAvatar: r.user.avatar,
      department: r.user.department?.name || ''
    })));
  });

  // POST /api/overtime
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { userId, date, regularHours, overtimeHours, reason } = request.body || {};

    if (!userId || !date || regularHours === undefined || overtimeHours === undefined) {
      return reply.code(400).send({ error: 'userId, date, regularHours, and overtimeHours are required' });
    }

    const existing = await prisma.overtimeRequest.findFirst({
      where: { userId, date, organizationId }
    });

    if (existing) {
      return reply.code(409).send({ error: 'Overtime request already exists for this date', request: existing });
    }

    const otRequest = await prisma.overtimeRequest.create({
      data: {
        userId,
        date,
        regularHours: parseFloat(regularHours),
        overtimeHours: parseFloat(overtimeHours),
        reason: reason || 'Auto-generated',
        status: 'pending',
        organizationId
      },
      include: { user: true }
    });

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('overtime:created', {
        id: otRequest.id,
        userId: otRequest.userId,
        userName: otRequest.user.name,
        date: otRequest.date,
        overtimeHours: otRequest.overtimeHours,
        status: otRequest.status
      });
    }

    return reply.code(201).send(otRequest);
  });

  // PATCH /api/overtime/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, email, organizationId } = request.user;
    const { id } = request.params;
    const { status, reviewNotes } = request.body || {};

    if (!['super_admin', 'admin', 'hr_manager', 'manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions to review overtime requests' });
    }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return reply.code(400).send({ error: 'Valid status is required ("approved" or "rejected")' });
    }

    const otRequest = await prisma.overtimeRequest.findFirst({
      where: { id, organizationId },
      include: { user: true }
    });

    if (!otRequest) {
      return reply.code(404).send({ error: 'Overtime request not found' });
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: email,
        reviewNotes: reviewNotes || null
      },
      include: { user: true }
    });

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('overtime:updated', {
        id: updated.id,
        userId: updated.userId,
        userName: updated.user.name,
        status: updated.status
      });
    }

    return reply.send(updated);
  });
}

module.exports = overtimeRoutes;
