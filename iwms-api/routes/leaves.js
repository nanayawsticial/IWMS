const prisma = require('../lib/prisma');

async function leavesRoutes(fastify) {
  // GET /api/leaves
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub } = request.user;
    
    let leaves;
    if (['super_admin', 'admin', 'hr_manager'].includes(role)) {
      leaves = await prisma.leaveRequest.findMany({
        include: { user: { include: { department: true } } },
        orderBy: { startDate: 'desc' }
      });
    } else if (role === 'manager') {
      const managerUser = await prisma.user.findUnique({
        where: { id: sub },
        select: { departmentId: true }
      });
      
      leaves = await prisma.leaveRequest.findMany({
        where: {
          user: { departmentId: managerUser.departmentId }
        },
        include: { user: { include: { department: true } } },
        orderBy: { startDate: 'desc' }
      });
    } else {
      leaves = await prisma.leaveRequest.findMany({
        where: { userId: sub },
        include: { user: { include: { department: true } } },
        orderBy: { startDate: 'desc' }
      });
    }
    
    return reply.send(leaves.map(l => ({
      id: l.id,
      userId: l.userId,
      startDate: l.startDate,
      endDate: l.endDate,
      type: l.type,
      status: l.status,
      reason: l.reason,
      managerNotes: l.managerNotes,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      userName: l.user.name,
      userEmail: l.user.email,
      department: l.user.department?.name || ''
    })));
  });

  // POST /api/leaves
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    const { startDate, endDate, type, reason } = request.body || {};

    if (!startDate || !endDate || !type) {
      return reply.code(400).send({ error: 'startDate, endDate, and type are required' });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: sub,
        startDate,
        endDate,
        type,
        reason: reason || '',
        status: 'pending'
      },
      include: { user: true }
    });

    if (global.io) {
      global.io.emit('leave:created', {
        id: leave.id,
        userName: leave.user.name,
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate
      });
    }

    return reply.code(201).send(leave);
  });

  // PATCH /api/leaves/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub } = request.user;
    const { id } = request.params;
    const { status, managerNotes } = request.body || {};

    if (!['super_admin', 'admin', 'hr_manager', 'manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions to approve leave' });
    }

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return reply.code(400).send({ error: 'Valid status is required' });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      return reply.code(404).send({ error: 'Leave request not found' });
    }

    if (role === 'manager') {
      const managerUser = await prisma.user.findUnique({
        where: { id: sub },
        select: { departmentId: true }
      });
      if (leave.user.departmentId !== managerUser.departmentId) {
        return reply.code(403).send({ error: 'You can only approve leaves for employees in your department' });
      }
    }

    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        managerNotes: managerNotes !== undefined ? managerNotes : leave.managerNotes
      },
      include: { user: true }
    });

    if (status === 'approved') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      for (const dateStr of dates) {
        await prisma.attendanceRecord.upsert({
          where: { userId_date: { userId: leave.userId, date: dateStr } },
          update: { status: 'on_leave', method: 'system' },
          create: {
            userId: leave.userId,
            date: dateStr,
            status: 'on_leave',
            method: 'system'
          }
        });
      }
    }

    if (global.io) {
      global.io.emit('leave:updated', {
        id: updatedLeave.id,
        userId: updatedLeave.userId,
        status: updatedLeave.status,
        userName: updatedLeave.user.name
      });
    }

    return reply.send(updatedLeave);
  });
}

module.exports = leavesRoutes;
