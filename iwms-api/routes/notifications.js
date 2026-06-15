const { sendMail, weeklyReportHtml, lateAlertHtml } = require('../lib/mailer');
const { getAttendanceStats } = require('../lib/cron');
const prisma = require('../lib/prisma');

async function notificationsRoutes(fastify) {
  // POST /api/notifications/test-email
  // Sends a real test email to Ethereal and returns the preview URL
  fastify.post('/test-email', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const today = new Date().toISOString().split('T')[0];
    const [stats, tasks] = await Promise.all([
      getAttendanceStats(today, organizationId),
      prisma.task.findMany({ where: { organizationId }, take: 5, orderBy: { updatedAt: 'desc' } }),
    ]);

    const html = weeklyReportHtml({ stats, tasks, topEmployees: [] });
    const result = await sendMail({
      to: 'test@iwms.io',
      subject: `📊 IWMS Weekly Report Test — ${today}`,
      html,
    });

    return reply.send({
      message: 'Test email sent! Open the preview URL to see it.',
      previewUrl: result.previewUrl,
      messageId: result.messageId,
    });
  });

  // POST /api/notifications/test-late-alert
  fastify.post('/test-late-alert', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const today = new Date().toISOString().split('T')[0];
    const allActive = await prisma.user.findMany({
      where: { status: 'active', organizationId },
      include: { department: true },
      take: 3,
    });

    const lateEmployees = allActive.map(u => ({
      name: u.name, avatar: u.avatar,
      department: u.department?.name || '—', position: u.position,
    }));

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const html = lateAlertHtml({ lateEmployees, date: dateStr });
    const result = await sendMail({
      to: 'manager@iwms.io',
      subject: `⚠️ Test Late Alert — ${lateEmployees.length} employees`,
      html,
    });

    // Also broadcast over WebSocket
    const io = global.io;
    if (io) {
      io.emit('attendance:lateAlert', {
        count: lateEmployees.length,
        employees: lateEmployees,
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      message: 'Late alert test sent!',
      previewUrl: result.previewUrl,
      employeesAlerted: lateEmployees.length,
    });
  });

  // POST /api/notifications/broadcast
  // Broadcast a custom event to all connected Socket.io clients
  fastify.post('/broadcast', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const { event, data } = request.body || {};
    if (!event) return reply.code(400).send({ error: 'event is required' });

    const io = global.io;
    if (io) {
      io.emit(event, { ...data, timestamp: new Date().toISOString(), sentBy: request.user.email });
      return reply.send({ message: `Event "${event}" broadcast to ${io.engine.clientsCount} clients` });
    }
    return reply.code(500).send({ error: 'Socket.io not initialized' });
  });

  // GET /api/notifications/socket-status
  fastify.get('/socket-status', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const io = global.io;
    return reply.send({
      connected: io ? io.engine.clientsCount : 0,
      socketReady: !!io,
    });
  });

  // GET /api/notifications
  // Fetches unread notifications for the user's organization and matching their role permissions
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;

    let allowedTargetRoles = [];
    if (role === 'super_admin') {
      allowedTargetRoles = ['SUPER_ADMIN'];
    } else if (['admin', 'hr_manager', 'manager'].includes(role)) {
      allowedTargetRoles = ['MANAGEMENT'];
    } else {
      // Employees and team leads do not receive system administrative alerts
      return reply.send([]);
    }

    const notifications = await prisma.notification.findMany({
      where: {
        organizationId,
        targetRole: { in: allowedTargetRoles },
        isRead: false
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return reply.send(notifications);
  });

  // POST /api/notifications/:id/read
  // Marks a notification as read
  fastify.post('/:id/read', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { organizationId } = request.user;

    // Verify ownership and existence
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId }
    });

    if (!notification) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return reply.send({ success: true });
  });

  // POST /api/notifications/read-all
  // Marks all unread notifications for the user's target role as read
  fastify.post('/read-all', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;

    let allowedTargetRoles = [];
    if (role === 'super_admin') {
      allowedTargetRoles = ['SUPER_ADMIN'];
    } else if (['admin', 'hr_manager', 'manager'].includes(role)) {
      allowedTargetRoles = ['MANAGEMENT'];
    } else {
      return reply.send({ success: true, count: 0 });
    }

    const { count } = await prisma.notification.updateMany({
      where: {
        organizationId,
        targetRole: { in: allowedTargetRoles },
        isRead: false
      },
      data: { isRead: true }
    });

    return reply.send({ success: true, count });
  });
}

module.exports = notificationsRoutes;
