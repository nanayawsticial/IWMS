const cron = require('node-cron');
const { sendMail, weeklyReportHtml, lateAlertHtml } = require('./mailer');
const prisma = require('./prisma');
const { ensureAutoDraft, getPreviousWeekRange } = require('./reportAutomation');

/**
 * Start all background cron jobs.
 * @param {import('socket.io').Server} io  — Socket.io server for broadcasting
 */
function startCronJobs(io) {

  // Auto-draft weekly reports every Monday at 06:00 AM for the previous week.
  cron.schedule('0 6 * * 1', async () => {
    const { startDate, endDate } = getPreviousWeekRange();
    console.log(`[CRON] Auto-drafting weekly reports for ${startDate} to ${endDate}...`);

    try {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      let created = 0;
      let existing = 0;

      for (const org of orgs) {
        try {
          const users = await prisma.user.findMany({
            where: {
              status: 'active',
              organizationId: org.id,
              OR: [
                {
                  attendance: {
                    some: {
                      organizationId: org.id,
                      date: { gte: startDate, lte: endDate },
                    },
                  },
                },
                {
                  timeLogs: {
                    some: {
                      date: { gte: startDate, lte: endDate },
                      task: { organizationId: org.id },
                    },
                  },
                },
                {
                  assignedTasks: {
                    some: {
                      organizationId: org.id,
                      OR: [
                        { scheduledDate: { gte: startDate, lte: endDate } },
                        { scheduledDate: null, dueDate: { gte: startDate, lte: endDate } },
                      ],
                    },
                  },
                },
              ],
            },
            select: { id: true },
          });

          for (const user of users) {
            const result = await ensureAutoDraft({
              userId: user.id,
              startDate,
              endDate,
              organizationId: org.id,
            });
            if (result.created) created++;
            else existing++;
          }
        } catch (orgErr) {
          console.error(`[CRON] Auto-draft failed for org ${org.id}:`, orgErr.message);
        }
      }

      console.log(`[CRON] Auto-draft complete. Created ${created}, skipped existing ${existing}.`);
    } catch (err) {
      console.error('[CRON] Auto-draft failed:', err.message);
    }
  });

  // ── Weekly Report ─────────────────────────────────────────────
  // Every Monday at 08:00 AM — scoped per-organization
  cron.schedule('0 8 * * 1', async () => {
    console.log('⏰ [CRON] Generating weekly report...');
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all active orgs in one query
      const orgs = await prisma.organization.findMany({ select: { id: true } });

      for (const org of orgs) {
        try {
          const [stats, tasks, managers] = await Promise.all([
            getAttendanceStats(today, org.id),
            prisma.task.findMany({ where: { organizationId: org.id }, take: 10, orderBy: { updatedAt: 'desc' } }),
            prisma.user.findMany({
              where: { role: { in: ['admin', 'manager', 'hr_manager'] }, status: 'active', organizationId: org.id },
              select: { email: true, name: true },
            }),
          ]);

          if (managers.length === 0) continue;

          const html = weeklyReportHtml({ stats, tasks, topEmployees: [] });
          for (const mgr of managers) {
            sendMail({ to: mgr.email, subject: `📊 IWMS Weekly Report — ${today}`, html }).catch(() => {});
          }

          // Broadcast only to this org's room
          io.to(`org:${org.id}`).emit('report:generated', { timestamp: new Date().toISOString(), date: today });
        } catch (orgErr) {
          console.error(`❌ [CRON] Weekly report failed for org ${org.id}:`, orgErr.message);
        }
      }

      console.log(`✅ [CRON] Weekly report processed for ${orgs.length} organizations`);
    } catch (err) {
      console.error('❌ [CRON] Weekly report failed:', err.message);
    }
  });

  // ── Late Attendance Alert ─────────────────────────────────────
  // Every weekday at 10:00 AM — scoped per-organization
  cron.schedule('0 10 * * 1-5', async () => {
    console.log('⏰ [CRON] Checking late attendance...');
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all active orgs in one query
      const orgs = await prisma.organization.findMany({ select: { id: true } });

      for (const org of orgs) {
        try {
          const [allActive, checkedIn] = await Promise.all([
            prisma.user.findMany({
              where: { status: 'active', organizationId: org.id },
              include: { department: true },
            }),
            prisma.attendanceRecord.findMany({
              where: { date: today, organizationId: org.id },
              select: { userId: true },
            }),
          ]);

          const checkedInIds = new Set(checkedIn.map(r => r.userId));
          const notCheckedIn = allActive.filter(u => !checkedInIds.has(u.id));

          if (notCheckedIn.length === 0) continue;

          const lateEmployees = notCheckedIn.map(u => ({
            name: u.name, avatar: u.avatar,
            department: u.department?.name || '—', position: u.position,
          }));

          const managers = await prisma.user.findMany({
            where: { role: { in: ['admin', 'manager', 'hr_manager'] }, status: 'active', organizationId: org.id },
            select: { email: true },
          });

          const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const html = lateAlertHtml({ lateEmployees, date: dateStr });
          for (const mgr of managers) {
            sendMail({ to: mgr.email, subject: `⚠️ ${notCheckedIn.length} employees not clocked in — ${dateStr}`, html }).catch(() => {});
          }

          // Broadcast only to this org's room
          io.to(`org:${org.id}`).emit('attendance:lateAlert', {
            count: notCheckedIn.length, employees: lateEmployees, timestamp: new Date().toISOString(),
          });
        } catch (orgErr) {
          console.error(`❌ [CRON] Late alert failed for org ${org.id}:`, orgErr.message);
        }
      }

      console.log('✅ [CRON] Late alert check complete');
    } catch (err) {
      console.error('❌ [CRON] Late alert failed:', err.message);
    }
  });

  // ── Heartbeat (keep Socket.io alive) ─────────────────────────
  // Every minute — broadcasts live attendance stats per organization
  cron.schedule('* * * * *', async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // One query for all orgs' user counts grouped by org
      // One query for all of today's attendance records
      const [userCounts, allRecords] = await Promise.all([
        prisma.user.groupBy({
          by: ['organizationId'],
          where: { status: 'active' },
          _count: { id: true },
        }),
        prisma.attendanceRecord.findMany({
          where: { date: today },
          select: { organizationId: true, userId: true, status: true },
        }),
      ]);

      // Build per-org record map in memory
      const recordsByOrg = {};
      for (const r of allRecords) {
        if (!recordsByOrg[r.organizationId]) recordsByOrg[r.organizationId] = [];
        recordsByOrg[r.organizationId].push(r);
      }

      const timestamp = new Date().toISOString();

      for (const orgCount of userCounts) {
        const orgId = orgCount.organizationId;
        const totalUsers = orgCount._count.id;
        const records = recordsByOrg[orgId] || [];

        const present = records.filter(r => r.status === 'present').length;
        const late    = records.filter(r => r.status === 'late').length;
        const absent  = records.filter(r => r.status === 'absent').length;
        const onLeave = records.filter(r => r.status === 'on_leave').length;

        const stats = {
          date: today, totalEmployees: totalUsers, present, late, absent, onLeave,
          presentWithLate: present + late,
          attendanceRate: totalUsers > 0 ? Math.round(((present + late) / totalUsers) * 100) : 0,
        };

        // Broadcast only to this org's room
        io.to(`org:${orgId}`).emit('stats:update', { stats, timestamp });
      }
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

  // ── Overtime Generation & Absent/Holiday Marking ──────────────────
  // Every day at 00:00 (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [CRON] Starting midnight cron tasks (overtime & absent/holiday checks)...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // 1. Overtime requests generation
      const records = await prisma.attendanceRecord.findMany({
        where: {
          date: yesterdayStr,
          hoursWorked: { gt: 8 }
        }
      });

      let otCount = 0;
      for (const r of records) {
        const existing = await prisma.overtimeRequest.findFirst({
          where: { userId: r.userId, date: yesterdayStr, organizationId: r.organizationId }
        });
        if (!existing) {
          const otHours = r.hoursWorked - 8;
          await prisma.overtimeRequest.create({
            data: {
              userId: r.userId,
              date: yesterdayStr,
              regularHours: 8,
              overtimeHours: otHours,
              reason: 'Auto-generated midnight cron job',
              organizationId: r.organizationId
            }
          });
          otCount++;
        }
      }
      console.log(`✅ [CRON] Generated ${otCount} overtime requests for ${yesterdayStr}`);

      // 2. Absent vs Holiday marking
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      let absentCount = 0;
      let holidayCount = 0;

      for (const org of orgs) {
        try {
          const [activeUsers, yesterdayRecords, holiday] = await Promise.all([
            prisma.user.findMany({
              where: { status: 'active', organizationId: org.id },
              select: { id: true }
            }),
            prisma.attendanceRecord.findMany({
              where: { date: yesterdayStr, organizationId: org.id },
              select: { userId: true }
            }),
            prisma.publicHoliday.findFirst({
              where: { date: yesterdayStr, organizationId: org.id }
            })
          ]);

          const recordedUserIds = new Set(yesterdayRecords.map(r => r.userId));
          const usersWithoutRecord = activeUsers.filter(u => !recordedUserIds.has(u.id));

          for (const user of usersWithoutRecord) {
            if (holiday) {
              await prisma.attendanceRecord.create({
                data: {
                  userId: user.id,
                  date: yesterdayStr,
                  status: 'on_leave',
                  method: 'system',
                  hoursWorked: 0,
                  notes: `Public Holiday: ${holiday.name}`,
                  organizationId: org.id
                }
              });
              holidayCount++;
            } else {
              await prisma.attendanceRecord.create({
                data: {
                  userId: user.id,
                  date: yesterdayStr,
                  status: 'absent',
                  method: 'system',
                  hoursWorked: 0,
                  notes: 'Absent (no clock-in recorded)',
                  organizationId: org.id
                }
              });
              absentCount++;
            }
          }
        } catch (orgErr) {
          console.error(`❌ [CRON] Midnight tasks failed for org ${org.id}:`, orgErr.message);
        }
      }
      console.log(`✅ [CRON] Midnight absent/holiday check completed. Marked ${absentCount} absent, ${holidayCount} on leave (holiday)`);
    } catch (err) {
      console.error('❌ [CRON] Midnight tasks failed:', err.message);
    }
  });

  console.log('✅ Cron jobs scheduled:');
  console.log('   📊 Weekly report:   Mon 08:00 AM (per-org scoped)');
  console.log('   ⚠️  Late alert:      Weekdays 10:00 AM (per-org scoped)');
  console.log('   💓 Stats heartbeat: Every 60s (per-org scoped, 2 global queries)');
  console.log('   🧹 Session cleanup:  Daily 03:00 AM');
  console.log('   ⏰ Overtime cron:    Daily 12:00 AM (midnight)');
}

async function getAttendanceStats(date, organizationId) {
  const recordWhere = { date };
  const userWhere = { status: 'active' };
  if (organizationId) {
    recordWhere.organizationId = organizationId;
    userWhere.organizationId = organizationId;
  }
  const [records, totalUsers] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: recordWhere }),
    prisma.user.count({ where: userWhere }),
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
