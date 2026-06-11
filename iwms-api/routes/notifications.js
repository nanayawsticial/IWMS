const { PrismaClient } = require('@prisma/client');
const { sendMail, weeklyReportHtml, lateAlertHtml } = require('../lib/mailer');
const { getAttendanceStats } = require('../lib/cron');

const prisma = new PrismaClient();

async function notificationsRoutes(fastify) {
  // POST /api/notifications/test-email
  // Sends a real test email to Ethereal and returns the preview URL
  fastify.post('/test-email', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const today = new Date().toISOString().split('T')[0];
    const [stats, tasks] = await Promise.all([
      getAttendanceStats(today),
      prisma.task.findMany({ take: 5, orderBy: { updatedAt: 'desc' } }),
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
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const today = new Date().toISOString().split('T')[0];
    const allActive = await prisma.user.findMany({
      where: { status: 'active' },
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
}

module.exports = notificationsRoutes;
