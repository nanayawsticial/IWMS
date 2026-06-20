const prisma = require('../lib/prisma');

async function hrRoutes(fastify) {
  // Authentication & authorization helper
  const verifyHrAccess = async (request, reply) => {
    const isHr = await isHrUser(request.user);
    if (!isHr) {
      return reply.code(403).send({ error: 'Forbidden: Restricted to HR department or administrator roles' });
    }
  };

  const isHrUser = async (user) => {
    if (!user) return false;
    if (['super_admin', 'admin', 'hr_manager'].includes(user.role)) {
      return true;
    }
    if (user.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: user.departmentId }
      });
      if (dept) {
        const name = dept.name.toLowerCase();
        if (name.includes('hr') || name.includes('human resource')) {
          return true;
        }
      }
    }
    if (user.department && typeof user.department === 'string') {
      const name = user.department.toLowerCase();
      if (name.includes('hr') || name.includes('human resource')) {
        return true;
      }
    }
    return false;
  };

  // GET /api/hr/dashboard
  fastify.get('/dashboard', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalEmployees, openLeaveRequestsCount, newHiresThisMonth] = await Promise.all([
      prisma.user.count({ where: { organizationId, status: 'active' } }),
      prisma.leaveRequest.count({ where: { organizationId, status: 'pending' } }),
      prisma.user.count({ where: { organizationId, createdAt: { gte: startOfMonth } } })
    ]);

    // Active approved leaves today
    const onLeaveToday = await prisma.leaveRequest.count({
      where: {
        organizationId,
        status: 'approved',
        startDate: { lte: todayStr },
        endDate: { gte: todayStr }
      }
    });

    // Ensure profiles exist for active users in this org
    const activeUsers = await prisma.user.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true }
    });

    await Promise.all(activeUsers.map(async (u) => {
      await prisma.employeeProfile.upsert({
        where: { userId: u.id },
        update: {},
        create: {
          userId: u.id,
          organizationId,
          employmentType: 'full_time',
          onboardingStatus: 'pending'
        }
      });
    }));

    // On probation
    const onProbation = await prisma.employeeProfile.count({
      where: {
        organizationId,
        user: { status: 'active' },
        OR: [
          { onboardingStatus: { not: 'complete' } },
          { probationEndDate: { gte: todayStr } }
        ]
      }
    });

    // Upcoming contract/probation endings (next 30 days)
    const endOfRangeStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().split('T')[0];
    const upcomingContractEndings = await prisma.employeeProfile.count({
      where: {
        organizationId,
        probationEndDate: {
          gte: todayStr,
          lte: endOfRangeStr
        }
      }
    });

    // Department breakdown
    const depts = await prisma.department.findMany({
      where: { organizationId },
      include: { users: { where: { status: 'active' } } }
    });
    const headcountByDepartment = depts.map(d => ({
      name: d.name,
      headcount: d.users.length
    }));

    // Employment type breakdown
    const profiles = await prisma.employeeProfile.findMany({
      where: { organizationId, user: { status: 'active' } }
    });
    const breakdown = { full_time: 0, part_time: 0, contract: 0, intern: 0 };
    profiles.forEach(p => {
      if (p.employmentType in breakdown) {
        breakdown[p.employmentType]++;
      } else {
        breakdown.full_time++;
      }
    });

    const employmentTypeBreakdown = Object.keys(breakdown).map(k => ({
      name: k === 'full_time' ? 'Full Time' : k === 'part_time' ? 'Part Time' : k === 'contract' ? 'Contract' : 'Intern',
      value: breakdown[k]
    }));

    // Today's approved leave details
    const openLeavesList = await prisma.leaveRequest.findMany({
      where: {
        organizationId,
        status: 'approved',
        startDate: { lte: todayStr },
        endDate: { gte: todayStr }
      },
      include: { user: { include: { department: true } } }
    });

    const openLeaves = openLeavesList.map(l => ({
      id: l.id,
      userName: l.user.name,
      userAvatar: l.user.avatar,
      department: l.user.department?.name || 'General',
      type: l.type,
      duration: `${l.startDate} to ${l.endDate}`
    }));

    // Recent activity list
    const [recentLeaves, recentProfiles] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: true }
      }),
      prisma.employeeProfile.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { user: true }
      })
    ]);

    const activities = [];
    recentLeaves.forEach(l => {
      if (!l.user) return;
      activities.push({
        id: `leave-${l.id}`,
        text: `${l.user.name} submitted a ${l.type} leave request (${l.status})`,
        time: l.createdAt
      });
    });
    recentProfiles.forEach(p => {
      if (!p.user) return;
      activities.push({
        id: `profile-${p.id}`,
        text: `Employee Profile updated for ${p.user.name} (${p.onboardingStatus})`,
        time: p.updatedAt
      });
    });

    const recentActivity = activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);

    return reply.send({
      totalEmployees,
      onProbation,
      onLeaveToday,
      newHiresThisMonth,
      upcomingContractEndings,
      openLeaveRequestsCount,
      headcountByDepartment,
      employmentTypeBreakdown,
      recentActivity,
      openLeaves
    });
  });

  // GET /api/hr/employees
  fastify.get('/employees', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const users = await prisma.user.findMany({
      where: { organizationId },
      include: { department: true, employeeProfile: true },
      orderBy: { name: 'asc' }
    });

    const employees = await Promise.all(users.map(async (u) => {
      let profile = u.employeeProfile;
      if (!profile) {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: u.id,
            organizationId,
            employmentType: 'full_time',
            onboardingStatus: 'pending'
          }
        });
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        position: u.position,
        phone: u.phone,
        avatar: u.avatar,
        status: u.status,
        joinDate: u.joinDate,
        department: u.department?.name || 'General',
        employeeProfile: profile
      };
    }));

    return reply.send(employees);
  });

  // GET /api/hr/employees/:id
  fastify.get('/employees/:id', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;

    const employee = await prisma.user.findFirst({
      where: { id, organizationId },
      include: { department: true, employeeProfile: true }
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    let profile = employee.employeeProfile;
    if (!profile) {
      profile = await prisma.employeeProfile.create({
        data: {
          userId: id,
          organizationId,
          employmentType: 'full_time',
          onboardingStatus: 'pending'
        }
      });
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: id, organizationId },
      orderBy: { startDate: 'desc' }
    });

    const attendance = await prisma.attendanceRecord.findMany({
      where: { userId: id, organizationId },
      orderBy: { date: 'desc' },
      take: 30
    });

    return reply.send({
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        position: employee.position,
        phone: employee.phone,
        avatar: employee.avatar,
        status: employee.status,
        joinDate: employee.joinDate,
        department: employee.department?.name || 'General',
        employeeProfile: profile
      },
      leaves,
      attendance
    });
  });

  // PATCH /api/hr/employees/:id/profile
  fastify.patch('/employees/:id/profile', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;
    const {
      employmentType, probationEndDate, noticePeriodDays, salary,
      bankName, bankAccount, emergencyContact, emergencyPhone,
      onboardingStatus, offboardingStatus, terminationDate, terminationReason
    } = request.body || {};

    const existingProfile = await prisma.employeeProfile.findUnique({
      where: { userId: id }
    });

    let profile;
    if (!existingProfile) {
      profile = await prisma.employeeProfile.create({
        data: {
          userId: id,
          organizationId,
          employmentType: employmentType || 'full_time',
          probationEndDate,
          noticePeriodDays: noticePeriodDays !== undefined ? parseInt(noticePeriodDays, 10) : 30,
          salary: salary !== undefined ? parseFloat(salary) : null,
          bankName: bankName || '',
          bankAccount: bankAccount || '',
          emergencyContact: emergencyContact || '',
          emergencyPhone: emergencyPhone || '',
          onboardingStatus: onboardingStatus || 'pending',
          offboardingStatus,
          terminationDate,
          terminationReason
        }
      });
    } else {
      profile = await prisma.employeeProfile.update({
        where: { userId: id },
        data: {
          employmentType,
          probationEndDate,
          noticePeriodDays: noticePeriodDays !== undefined ? parseInt(noticePeriodDays, 10) : undefined,
          salary: salary !== undefined ? parseFloat(salary) : undefined,
          bankName,
          bankAccount,
          emergencyContact,
          emergencyPhone,
          onboardingStatus,
          offboardingStatus,
          terminationDate,
          terminationReason
        }
      });
    }

    return reply.send(profile);
  });

  // POST /api/hr/employees/:id/onboard
  fastify.post('/employees/:id/onboard', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { id } = request.params;
    const profile = await prisma.employeeProfile.update({
      where: { userId: id },
      data: { onboardingStatus: 'complete' }
    });
    return reply.send(profile);
  });

  // POST /api/hr/employees/:id/offboard
  fastify.post('/employees/:id/offboard', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { id } = request.params;
    const profile = await prisma.employeeProfile.update({
      where: { userId: id },
      data: { offboardingStatus: 'initiated' }
    });
    return reply.send(profile);
  });

  // GET /api/hr/leave-requests
  fastify.get('/leave-requests', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const leaves = await prisma.leaveRequest.findMany({
      where: { organizationId, status: 'pending' },
      include: { user: { include: { department: true } } },
      orderBy: { startDate: 'asc' }
    });

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
      userName: l.user.name,
      userEmail: l.user.email,
      department: l.user.department?.name || 'General'
    })));
  });

  // GET /api/hr/headcount
  fastify.get('/headcount', { onRequest: [fastify.authenticate, verifyHrAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const depts = await prisma.department.findMany({
      where: { organizationId },
      include: { users: { where: { status: 'active' } } }
    });
    
    const profiles = await prisma.employeeProfile.findMany({
      where: { organizationId, user: { status: 'active' } }
    });

    const byDepartment = depts.map(d => ({
      name: d.name,
      headcount: d.users.length
    }));

    const byType = { full_time: 0, part_time: 0, contract: 0, intern: 0 };
    profiles.forEach(p => {
      if (p.employmentType in byType) {
        byType[p.employmentType]++;
      } else {
        byType.full_time++;
      }
    });

    const active = await prisma.user.count({ where: { organizationId, status: 'active' } });
    const inactive = await prisma.user.count({ where: { organizationId, status: 'inactive' } });

    return reply.send({
      byDepartment,
      byEmploymentType: Object.keys(byType).map(k => ({
        name: k === 'full_time' ? 'Full Time' : k === 'part_time' ? 'Part Time' : k === 'contract' ? 'Contract' : 'Intern',
        value: byType[k]
      })),
      byStatus: [
        { name: 'Active', value: active },
        { name: 'Inactive', value: inactive }
      ]
    });
  });
}

module.exports = hrRoutes;
