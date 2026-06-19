const prisma = require('../lib/prisma');

async function managementRoutes(fastify) {
  // GET /api/management/dashboard
  fastify.get('/dashboard', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;

    // Check if the user is authorized (super_admin, admin, or manager)
    if (!['super_admin', 'admin', 'manager'].includes(role)) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // 1. Headcount KPIs
    const [totalHeadcount, activeHeadcount, newHiresThisMonth] = await Promise.all([
      prisma.user.count({ where: { organizationId } }),
      prisma.user.count({ where: { status: 'active', organizationId } }),
      prisma.user.count({ where: { organizationId, createdAt: { gte: startOfMonth } } })
    ]);

    // Active approved leaves today
    const onLeaveHeadcount = await prisma.leaveRequest.count({
      where: {
        organizationId,
        status: 'approved',
        startDate: { lte: todayStr },
        endDate: { gte: todayStr }
      }
    });

    // 2. Attendance KPIs (current calendar month)
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        date: { gte: startOfMonthStr, lte: endOfMonthStr }
      }
    });

    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const totalAttendanceRecs = presentCount + lateCount + absentCount;
    const attendanceRate = totalAttendanceRecs > 0 ? (presentCount + lateCount) / totalAttendanceRecs : 0;

    const recordsWithHours = attendanceRecords.filter(r => ['present', 'late'].includes(r.status) && r.hoursWorked !== null);
    const avgHoursWorked = recordsWithHours.length > 0
      ? recordsWithHours.reduce((sum, r) => sum + r.hoursWorked, 0) / recordsWithHours.length
      : 0;

    // 3. Task KPIs
    const [totalTasks, completedTasks, inProgressTasks, taskGroups] = await Promise.all([
      prisma.task.count({ where: { organizationId } }),
      prisma.task.count({ where: { status: 'done', organizationId } }),
      prisma.task.count({ where: { status: 'in_progress', organizationId } }),
      prisma.task.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true
      })
    ]);

    const statusDistribution = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 };
    taskGroups.forEach(g => {
      if (g.status in statusDistribution) {
        statusDistribution[g.status] = g._count ?? 0;
      }
    });

    const overdueTasks = await prisma.task.count({
      where: {
        organizationId,
        status: { not: 'done' },
        dueDate: { lt: todayStr }
      }
    });
    const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // 4. Departmental Breakdown
    const depts = await prisma.department.findMany({
      where: { organizationId },
      include: {
        users: { where: { status: 'active' } },
        tasks: true
      }
    });

    const departmentsData = depts.map(d => {
      const userIds = d.users.map(u => u.id);
      const deptRecords = attendanceRecords.filter(r => userIds.includes(r.userId));
      const dp = deptRecords.filter(r => ['present', 'late'].includes(r.status)).length;
      const dTotal = deptRecords.filter(r => ['present', 'late', 'absent'].includes(r.status)).length;
      const deptAttendanceRate = dTotal > 0 ? dp / dTotal : 0;

      const dTasks = d.tasks;
      const dCompleted = dTasks.filter(t => t.status === 'done').length;
      const deptTaskRate = dTasks.length > 0 ? dCompleted / dTasks.length : 0;

      return {
        id: d.id,
        name: d.name,
        color: d.color,
        headcount: d.users.length,
        attendanceRate: deptAttendanceRate,
        taskCompletionRate: deptTaskRate
      };
    });

    // 5. Top Performers (current calendar month)
    const activeUsers = await prisma.user.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true, name: true, avatar: true, department: { select: { name: true } } }
    });

    const completedTasksThisMonth = await prisma.task.findMany({
      where: {
        organizationId,
        status: 'done',
        updatedAt: { gte: startOfMonth }
      },
      select: { assigneeId: true }
    });

    const topPerformers = activeUsers.map(user => {
      const tasksCompleted = completedTasksThisMonth.filter(t => t.assigneeId === user.id).length;
      const userRecords = attendanceRecords.filter(r => r.userId === user.id);
      const uPresent = userRecords.filter(r => ['present', 'late'].includes(r.status)).length;
      const uTotal = userRecords.filter(r => ['present', 'late', 'absent'].includes(r.status)).length;
      const userAttendanceRate = uTotal > 0 ? uPresent / uTotal : 0;
      const hoursWorked = userRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

      return {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        department: user.department?.name || 'General',
        tasksCompleted,
        attendanceRate: userAttendanceRate,
        hoursWorked
      };
    })
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5);

    // 6. Recent Activities (unified log)
    const [recentAttendance, recentTasks, recentLeaves, recentReports] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, avatar: true } } }
      }),
      prisma.task.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { assignee: { select: { name: true, avatar: true } } }
      }),
      prisma.leaveRequest.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, avatar: true } } }
      }),
      prisma.weeklyReport.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, avatar: true } } }
      })
    ]);

    const activities = [];

    recentAttendance.forEach(r => {
      if (!r.user) return;
      activities.push({
        type: 'attendance',
        user: { name: r.user.name, avatar: r.user.avatar },
        description: `${r.user.name} clocked ${r.clockOut ? 'out' : 'in'} (${r.status}) at ${r.clockOut || r.clockIn || '—'}`,
        timestamp: r.updatedAt.toISOString()
      });
    });

    recentTasks.forEach(t => {
      if (!t.assignee) return;
      activities.push({
        type: 'task',
        user: { name: t.assignee.name, avatar: t.assignee.avatar },
        description: `Task "${t.title}" updated to status "${t.status.toUpperCase()}"`,
        timestamp: t.updatedAt.toISOString()
      });
    });

    recentLeaves.forEach(l => {
      if (!l.user) return;
      activities.push({
        type: 'leave',
        user: { name: l.user.name, avatar: l.user.avatar },
        description: `${l.user.name} submitted a ${l.type} leave request (${l.status})`,
        timestamp: l.createdAt.toISOString()
      });
    });

    recentReports.forEach(rep => {
      if (!rep.user) return;
      activities.push({
        type: 'report',
        user: { name: rep.user.name, avatar: rep.user.avatar },
        description: `${rep.user.name} submitted a weekly report (${rep.status})`,
        timestamp: rep.createdAt.toISOString()
      });
    });

    const recentActivity = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15);

    return reply.send({
      headcount: {
        total: totalHeadcount,
        active: activeHeadcount,
        onLeave: onLeaveHeadcount,
        new_this_month: newHiresThisMonth
      },
      attendance: {
        rate: attendanceRate,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        avgHoursWorked
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        overdue: overdueTasks,
        completionRate: taskCompletionRate,
        statusDistribution
      },
      departments: departmentsData,
      topPerformers,
      recentActivity
    });
  });
}

module.exports = managementRoutes;
