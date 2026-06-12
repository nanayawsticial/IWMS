const cron = require('node-cron');
const { sendMail, weeklyReportHtml, lateAlertHtml } = require('./mailer');
const prisma = require('./prisma');

/**
 * Start all background cron jobs.
 * @param {import('socket.io').Server} io  — Socket.io server for broadcasting
 */
function startCronJobs(io) {

  // ── Weekly Report ─────────────────────────────────────────────
  // Every Monday at 08:00 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('⏰ [CRON] Generating weekly report...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const [stats, tasks, managers] = await Promise.all([
        getAttendanceStats(today),
        prisma.task.findMany({ take: 10, orderBy: { updatedAt: 'desc' } }),
        prisma.user.findMany({ where: { role: { in: ['admin', 'manager', 'hr_manager'] }, status: 'active' }, select: { email: true, name: true } }),
      ]);

      const html = weeklyReportHtml({ stats, tasks, topEmployees: [] });

      for (const mgr of managers) {
        await sendMail({ to: mgr.email, subject: `📊 IWMS Weekly Report — ${today}`, html });
      }

      // Broadcast to all connected clients
      io.emit('report:generated', { timestamp: new Date().toISOString(), date: today });
      console.log(`✅ [CRON] Weekly report sent to ${managers.length} managers`);
    } catch (err) {
      console.error('❌ [CRON] Weekly report failed:', err.message);
    }
  });

  // ── Late Attendance Alert ─────────────────────────────────────
  // Every day at 10:00 AM
  cron.schedule('0 10 * * 1-5', async () => {
    console.log('⏰ [CRON] Checking late attendance...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const allActive = await prisma.user.findMany({
        where: { status: 'active' },
        include: { department: true },
      });
      const checkedIn = await prisma.attendanceRecord.findMany({ where: { date: today } });
      const checkedInIds = new Set(checkedIn.map(r => r.userId));

      const notCheckedIn = allActive.filter(u => !checkedInIds.has(u.id));
      if (notCheckedIn.length === 0) {
        console.log('✅ [CRON] All employees checked in — no alert needed');
        return;
      }

      const lateEmployees = notCheckedIn.map(u => ({
        name: u.name, avatar: u.avatar,
        department: u.department?.name || '—', position: u.position,
      }));

      const managers = await prisma.user.findMany({
        where: { role: { in: ['admin', 'manager', 'hr_manager'] }, status: 'active' },
        select: { email: true },
      });

      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const html = lateAlertHtml({ lateEmployees, date: dateStr });
      for (const mgr of managers) {
        await sendMail({ to: mgr.email, subject: `⚠️ ${notCheckedIn.length} employees not clocked in — ${dateStr}`, html });
      }

      // Real-time broadcast
      io.emit('attendance:lateAlert', { count: notCheckedIn.length, employees: lateEmployees, timestamp: new Date().toISOString() });
      console.log(`✅ [CRON] Late alert sent — ${notCheckedIn.length} not checked in`);
    } catch (err) {
      console.error('❌ [CRON] Late alert failed:', err.message);
    }
  });

  // ── Heartbeat (keep Socket.io alive) ─────────────────────────
  // Every minute — broadcasts live attendance stats
  cron.schedule('* * * * *', async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = await getAttendanceStats(today);
      io.emit('stats:update', { stats, timestamp: new Date().toISOString() });
    } catch (_) {}
  });

  // ── Session Cleanup ───────────────────────────────────────────
  // Every day at 03:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ [CRON] Cleaning up expired sessions...');
    try {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
      console.log(`✅ [CRON] Cleaned up ${result.count} expired sessions`);
    } catch (err) {
      console.error('❌ [CRON] Session cleanup failed:', err.message);
    }
  });

  console.log('✅ Cron jobs scheduled:');
  console.log('   📊 Weekly report:   Mon 08:00 AM');
  console.log('   ⚠️  Late alert:      Weekdays 10:00 AM');
  console.log('   💓 Stats heartbeat: Every 60s');
  console.log('   🧹 Session cleanup:  Daily 03:00 AM');
}

async function getAttendanceStats(date) {
  const [records, totalUsers] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { date } }),
    prisma.user.count({ where: { status: 'active' } }),
  ]);
  const present = records.filter(r => r.status === 'present').length;
  const late    = records.filter(r => r.status === 'late').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const onLeave = records.filter(r => r.status === 'on_leave').length;
  return {
    date, totalEmployees: totalUsers, present, late, absent, onLeave,
    presentWithLate: present + late,
    attendanceRate: totalUsers > 0 ? Math.round(((present + late) / totalUsers) * 100) : 0,
  };
}

module.exports = { startCronJobs, getAttendanceStats };
