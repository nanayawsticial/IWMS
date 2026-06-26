const prisma = require('../lib/prisma');

function addAndFilter(whereClause, condition) {
  if (whereClause.OR) {
    whereClause.AND = [...(whereClause.AND || []), { OR: whereClause.OR }, condition];
    delete whereClause.OR;
  } else {
    whereClause.AND = [...(whereClause.AND || []), condition];
  }
}

async function getAvailableHoursForDate(userId, date, organizationId) {
  const attendance = await prisma.attendanceRecord.findFirst({
    where: { userId, date, organizationId },
    select: { hoursWorked: true },
  });
  return {
    availableHours: typeof attendance?.hoursWorked === 'number' ? attendance.hoursWorked : 7,
    attendanceSource: typeof attendance?.hoursWorked === 'number' ? 'record' : 'default',
  };
}

async function tasksRoutes(fastify) {
  // GET /api/tasks
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { status, priority, assigneeId, projectId, scheduledDate, dueDateFrom, dueDateTo } = request.query || {};

    const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(role);
    const isManager = ['manager', 'team_lead'].includes(role);
    const canViewAll = isAdmin || isManager;
    let whereClause = { organizationId };

    if (!canViewAll) {
      // Regular employees see tasks where they are the assignee OR the reviewer
      whereClause.OR = [
        { assigneeId: sub },
        { reviewerId: sub },
      ];
    }

    // Handle assigneeId filter with role-based scoping
    if (assigneeId) {
      if (isAdmin) {
        // Admins can view any user's tasks
        whereClause.assigneeId = assigneeId;
      } else if (isManager) {
        // Managers can only view tasks of their own department members
        const [currentManager, targetUser] = await Promise.all([
          prisma.user.findFirst({ where: { id: sub, organizationId }, select: { departmentId: true } }),
          prisma.user.findFirst({ where: { id: assigneeId, organizationId }, select: { id: true, departmentId: true } }),
        ]);
        if (!targetUser) return reply.code(404).send({ error: 'User not found' });
        if (assigneeId !== sub && currentManager?.departmentId !== targetUser.departmentId) {
          return reply.code(403).send({ error: 'Managers can only view tasks of employees in their own department' });
        }
        whereClause.assigneeId = assigneeId;
      } else {
        // Regular employees cannot view others' tasks
        if (assigneeId !== sub) {
          return reply.code(403).send({ error: 'Insufficient permissions to view other users\' tasks' });
        }
        whereClause.assigneeId = assigneeId;
      }
    }

    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (projectId) whereClause.projectId = projectId;
    if (scheduledDate) {
      addAndFilter(whereClause, {
        OR: [
          { scheduledDate },
          { scheduledDate: null, dueDate: scheduledDate },
        ],
      });
    }
    if (dueDateFrom || dueDateTo) {
      const dueDate = {};
      if (dueDateFrom) dueDate.gte = dueDateFrom;
      if (dueDateTo) dueDate.lte = dueDateTo;
      addAndFilter(whereClause, {
        OR: [
          { scheduledDate: dueDate },
          { scheduledDate: null, dueDate },
        ],
      });
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, avatar: true, email: true } },
        creator: { select: { id: true, name: true, avatar: true, email: true } },
        reviewer: { select: { id: true, name: true, avatar: true, email: true } },
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { comments: true, timeLogs: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return reply.send(tasks.map(t => ({
      ...t,
      tags: JSON.parse(t.tags || '[]'),
      assigneeName: t.assignee.name,
      assigneeAvatar: t.assignee.avatar,
      creatorName: t.creator?.name || 'System',
      creatorAvatar: t.creator?.avatar || '',
      reviewerName: t.reviewer?.name || t.creator?.name || 'System',
      reviewerAvatar: t.reviewer?.avatar || t.creator?.avatar || '',
      commentCount: t._count?.comments ?? 0,
      timeLogCount: t._count?.timeLogs ?? 0,
    })));
  });

  // POST /api/tasks
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user;
    const {
      title, description, assigneeId, reviewerId, priority, status, dueDate, scheduledDate,
      tags, projectId, projectName, estimatedHours, departmentId,
      outcomeImpact, deliverableLink, blockerNote,
    } = request.body || {};

    if (!title || !assigneeId) {
      return reply.code(400).send({ error: 'title and assigneeId are required' });
    }

    const assigner = await prisma.user.findFirst({
      where: { id: sub, organizationId },
      include: { department: true }
    });
    if (!assigner) return reply.code(401).send({ error: 'Unauthorized' });

    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, organizationId },
      include: { department: true }
    });
    if (!assignee) return reply.code(404).send({ error: 'Assignee user not found' });

    if (reviewerId) {
      const reviewer = await prisma.user.findFirst({ where: { id: reviewerId, organizationId } });
      if (!reviewer) return reply.code(404).send({ error: 'Reviewer user not found' });
    }

    const perm = verifyTaskAssignmentPermission(assigner, assignee);
    if (!perm.allowed) {
      return reply.code(403).send({ error: perm.error });
    }

    const resolvedDeptId = departmentId || assignee.departmentId || null;

    const resolvedDueDate = dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        assigneeId,
        creatorId: sub,
        reviewerId: reviewerId || sub, // defaults to creator
        priority: priority || 'medium',
        status: status || 'todo',
        dueDate: resolvedDueDate,
        scheduledDate: scheduledDate || resolvedDueDate,
        tags: JSON.stringify(tags || []),
        projectId: projectId || 'general',
        projectName: projectName || 'General',
        outcomeImpact: outcomeImpact || null,
        deliverableLink: deliverableLink || null,
        blockerNote: blockerNote || null,
        estimatedHours: estimatedHours || 8,
        loggedHours: 0,
        departmentId: resolvedDeptId,
        organizationId,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true, avatar: true } },
        reviewer: { select: { id: true, name: true, avatar: true } },
        department: { select: { id: true, name: true, color: true } },
      },
    });

    // Broadcast new task assignment
    const io = global.io;
    if (io) {
      io.to(`org:${organizationId}`).emit('task:updated', {
        id: task.id,
        status: task.status,
        priority: task.priority,
        title: task.title,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        reviewerId: task.reviewerId,
        text: `📋 ${assigner.name} assigned you a new task: "${task.title}"`,
        updatedBy: assigner.email,
        updatedByName: assigner.name,
        timestamp: new Date().toISOString(),
      });
    }

    return reply.code(201).send({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      assigneeName: task.assignee.name,
      assigneeAvatar: task.assignee.avatar,
      creatorName: task.creator?.name || 'System',
      reviewerName: task.reviewer?.name || task.creator?.name || 'System',
    });
  });

  // PATCH /api/tasks/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { id } = request.params;

    const existing = await prisma.task.findFirst({ 
      where: { id, organizationId },
      include: {
        assignee: true,
        creator: true,
        reviewer: true
      }
    });
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    if (!(await canAccessTask(existing, request.user))) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const {
      title, description, assigneeId, reviewerId, priority, status, dueDate, scheduledDate,
      tags, projectId, projectName, estimatedHours, loggedHours, departmentId,
      outcomeImpact, deliverableLink, blockerNote,
    } = request.body || {};

    // Workflow check: If status is being changed to DONE
    // It must be verified/approved by the reviewer or creator, not the assignee directly.
    if (status === 'done' && existing.status !== 'done') {
      const isAssignee = sub === existing.assigneeId;
      const isReviewer = sub === existing.reviewerId || sub === existing.creatorId;
      const isAdmin = ['super_admin', 'admin'].includes(role);

      if (isAssignee && !isReviewer && !isAdmin) {
        const reviewerName = existing.reviewer?.name || existing.creator?.name || 'Reviewer';
        return reply.code(403).send({ 
          error: `This task requires review confirmation from ${reviewerName} before it can be marked as Done. Move it to In Review instead.` 
        });
      }
    }

    const newAssigneeId = assigneeId !== undefined ? assigneeId : existing.assigneeId;

    const assigner = await prisma.user.findFirst({
      where: { id: sub, organizationId },
      include: { department: true }
    });
    if (!assigner) return reply.code(401).send({ error: 'Unauthorized' });

    const assignee = await prisma.user.findFirst({
      where: { id: newAssigneeId, organizationId },
      include: { department: true }
    });
    if (!assignee) return reply.code(404).send({ error: 'Assignee user not found' });

    if (reviewerId) {
      const reviewer = await prisma.user.findFirst({ where: { id: reviewerId, organizationId } });
      if (!reviewer) return reply.code(404).send({ error: 'Reviewer user not found' });
    }

    const perm = verifyTaskAssignmentPermission(assigner, assignee);
    if (!perm.allowed) {
      return reply.code(403).send({ error: perm.error });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (reviewerId !== undefined) updateData.reviewerId = reviewerId;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate || null;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (projectId !== undefined) updateData.projectId = projectId;
    if (projectName !== undefined) updateData.projectName = projectName;
    if (outcomeImpact !== undefined) updateData.outcomeImpact = outcomeImpact || null;
    if (deliverableLink !== undefined) updateData.deliverableLink = deliverableLink || null;
    if (blockerNote !== undefined) updateData.blockerNote = blockerNote || null;
    if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours;
    if (loggedHours !== undefined) updateData.loggedHours = loggedHours;
    if (departmentId !== undefined) updateData.departmentId = departmentId;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true, avatar: true } },
        reviewer: { select: { id: true, name: true, avatar: true } },
        department: { select: { id: true, name: true, color: true } },
      },
    });

    // Custom notification texts for socket broadcast
    let notifText = `📋 "${task.title}" moved to ${task.status.toUpperCase()} by ${assigner.name}`;
    if (status === 'review' && existing.status !== 'review') {
      notifText = `🔍 Task Review Request: ${task.assignee.name} completed "${task.title}" and requested review.`;
    } else if (status === 'done' && existing.status !== 'done') {
      notifText = `✅ Task Approved: ${assigner.name} approved your task "${task.title}" and confirmed it as Completed.`;
    }

    // Broadcast real-time task update to all connected clients
    const io = global.io;
    if (io) {
      // Broadcast global task update for UI refresh
      io.to(`org:${organizationId}`).emit('task:updated', {
        id: task.id,
        status: task.status,
        priority: task.priority,
        title: task.title,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        reviewerId: task.reviewerId,
        text: notifText,
        updatedBy: request.user.email,
        updatedByName: assigner.name,
        timestamp: new Date().toISOString(),
      });

      // Targeted notification: alert the reviewer when task enters review
      if (status === 'review' && existing.status !== 'review' && task.reviewerId && task.reviewerId !== sub) {
        io.to(`user:${task.reviewerId}`).emit('task:reviewRequested', {
          id: task.id,
          title: task.title,
          assigneeName: task.assignee.name,
          text: notifText,
          timestamp: new Date().toISOString(),
        });
      }

      // Targeted notification: alert the assignee when task is approved (done)
      if (status === 'done' && existing.status !== 'done' && task.assigneeId && task.assigneeId !== sub) {
        io.to(`user:${task.assigneeId}`).emit('task:approved', {
          id: task.id,
          title: task.title,
          reviewerName: assigner.name,
          text: notifText,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return reply.send({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      assigneeName: task.assignee.name,
      assigneeAvatar: task.assignee.avatar,
      creatorName: task.creator?.name || 'System',
      reviewerName: task.reviewer?.name || task.creator?.name || 'System',
    });
  });

  // DELETE /api/tasks/:id
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin', 'manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const task = await prisma.task.findFirst({ where: { id: request.params.id, organizationId } });
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    if (!(await canAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Insufficient permissions to delete this task' });
    }

    try {
      await prisma.task.delete({ where: { id: request.params.id } });
      return reply.send({ message: 'Task deleted successfully' });
    } catch (err) {
      if (err.code === 'P2025') return reply.code(404).send({ error: 'Task not found' });
      throw err;
    }
  });

  // GET /api/tasks/daily-budget
  fastify.get('/daily-budget', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { date, userId } = request.query || {};

    if (!date) {
      return reply.code(400).send({ error: 'date is required' });
    }

    const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(role);
    const targetUserId = userId || sub;
    if (userId && !isAdmin) {
      return reply.code(403).send({ error: 'Only admins can view another user daily budget' });
    }

    const [availability, tasks, dayLogs] = await Promise.all([
      getAvailableHoursForDate(targetUserId, date, organizationId),
      prisma.task.findMany({
        where: {
          organizationId,
          assigneeId: targetUserId,
          OR: [
            { scheduledDate: date },
            { scheduledDate: null, dueDate: date },
          ],
        },
        include: {
          timeLogs: {
            where: { userId: targetUserId, date },
            select: { hours: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      }),
      prisma.taskTimeLog.findMany({
        where: {
          userId: targetUserId,
          date,
          task: { organizationId },
        },
        select: { hours: true },
      }),
    ]);

    const estimatedHoursTotal = tasks.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);
    const loggedHoursTotal = dayLogs.reduce((sum, log) => sum + (Number(log.hours) || 0), 0);
    const budgetStatus = estimatedHoursTotal > availability.availableHours
      ? 'over'
      : availability.availableHours - estimatedHoursTotal <= 0.5
        ? 'near'
        : 'ok';

    return reply.send({
      date,
      availableHours: availability.availableHours,
      attendanceSource: availability.attendanceSource,
      estimatedHoursTotal: Math.round(estimatedHoursTotal * 10) / 10,
      loggedHoursTotal: Math.round(loggedHoursTotal * 10) / 10,
      budgetStatus,
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        estimatedHours: Number(task.estimatedHours) || 0,
        loggedToday: Math.round(task.timeLogs.reduce((sum, log) => sum + (Number(log.hours) || 0), 0) * 10) / 10,
      })),
    });
  });

  // GET /api/tasks/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { id } = request.params;
    const task = await prisma.task.findFirst({
      where: { id, organizationId },
      include: {
        assignee: { select: { id: true, name: true, avatar: true, email: true } },
        creator:  { select: { id: true, name: true, avatar: true, email: true } },
        reviewer: { select: { id: true, name: true, avatar: true, email: true } },
        department: { select: { id: true, name: true, color: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        timeLogs: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) return reply.code(404).send({ error: 'Task not found' });

    if (!(await canAccessTask(task, { role, sub, organizationId }))) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    return reply.send({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      assigneeName: task.assignee.name,
      assigneeAvatar: task.assignee.avatar,
      creatorName: task.creator?.name || 'System',
      reviewerName: task.reviewer?.name || task.creator?.name || 'System',
      comments: task.comments.map(c => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        content: c.content,
        createdAt: c.createdAt,
        userName: c.user.name,
        userAvatar: c.user.avatar,
      })),
      timeLogs: task.timeLogs.map(l => ({
        id: l.id,
        taskId: l.taskId,
        userId: l.userId,
        hours: l.hours,
        date: l.date,
        note: l.note,
        createdAt: l.createdAt,
        userName: l.user.name,
        userAvatar: l.user.avatar,
      }))
    });
  });

  // POST /api/tasks/:id/comments
  fastify.post('/:id/comments', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body || {};
    const { sub, organizationId } = request.user;

    if (!content) {
      return reply.code(400).send({ error: 'Comment content is required' });
    }

    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (!(await canAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        userId: sub,
        content
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('task:commentAdded', {
        taskId: id,
        commentId: comment.id,
        content: comment.content,
        userName: comment.user.name
      });
    }

    return reply.code(201).send({
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      userName: comment.user.name,
      userAvatar: comment.user.avatar
    });
  });

  // PATCH /api/tasks/:id/comments/:commentId
  fastify.patch('/:id/comments/:commentId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id, commentId } = request.params;
    const { content } = request.body || {};
    const { organizationId } = request.user;

    if (!content) {
      return reply.code(400).send({ error: 'Comment content is required' });
    }

    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (!(await canAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const existing = await prisma.taskComment.findFirst({
      where: { id: commentId, taskId: id },
    });
    if (!existing) return reply.code(404).send({ error: 'Comment not found' });

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('task:commentAdded', {
        taskId: id,
        commentId: comment.id,
        content: comment.content,
        userName: comment.user.name
      });
    }

    return reply.send({
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      userName: comment.user.name,
      userAvatar: comment.user.avatar
    });
  });

  // POST /api/tasks/:id/timelogs
  fastify.post('/:id/timelogs', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { hours, date, note } = request.body || {};
    const { sub, organizationId } = request.user;

    if (hours === undefined || !date) {
      return reply.code(400).send({ error: 'hours and date are required' });
    }

    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (!(await canAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const timeLog = await prisma.taskTimeLog.create({
      data: {
        taskId: id,
        userId: sub,
        hours: parseFloat(hours),
        date,
        note: note || ''
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });

    const totalLogged = await prisma.taskTimeLog.aggregate({
      where: { taskId: id },
      _sum: { hours: true }
    });

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { loggedHours: Math.round(totalLogged._sum.hours || 0) },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } }
      }
    });

    const [availability, userDayLogTotals] = await Promise.all([
      getAvailableHoursForDate(sub, date, organizationId),
      prisma.taskTimeLog.aggregate({
        where: {
          userId: sub,
          date,
          task: { organizationId },
        },
        _sum: { hours: true },
      }),
    ]);

    const totalLoggedToday = Math.round((userDayLogTotals._sum.hours || 0) * 10) / 10;
    const warning = totalLoggedToday > availability.availableHours;
    const warningMessage = warning
      ? `You've logged ${totalLoggedToday}h total today. Your available hours are ${availability.availableHours}h.`
      : '';

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('task:updated', {
        id: updatedTask.id,
        status: updatedTask.status,
        priority: updatedTask.priority,
        title: updatedTask.title,
        assigneeName: updatedTask.assignee.name,
        updatedBy: request.user.email,
        timestamp: new Date().toISOString()
      });
    }

    return reply.code(201).send({
      id: timeLog.id,
      taskId: timeLog.taskId,
      userId: timeLog.userId,
      hours: timeLog.hours,
      date: timeLog.date,
      note: timeLog.note,
      createdAt: timeLog.createdAt,
      userName: timeLog.user.name,
      userAvatar: timeLog.user.avatar,
      warning,
      warningMessage,
      totalLoggedToday,
      availableHours: availability.availableHours,
    });
  });
}

async function canAccessTask(task, user) {
  const { role, sub, organizationId } = user;
  if (['super_admin', 'admin', 'hr_manager', 'team_lead'].includes(role)) return true;
  if (task.assigneeId === sub) return true;
  if (task.reviewerId === sub) return true; // Reviewer can also access for review actions

  const dbUser = await prisma.user.findFirst({
    where: { id: sub, organizationId },
    select: { position: true, departmentId: true }
  });
  if (!dbUser) return false;

  const isSpecialManager = ['Administrator', 'Operation Manager', 'HR Manager', 'Finance Manager'].includes(dbUser.position);
  if (isSpecialManager) return true;

  if (role !== 'manager' || !task.departmentId) return false;
  return task.departmentId === dbUser.departmentId;
}

async function getUserDepartmentId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  return user?.departmentId || null;
}

function verifyTaskAssignmentPermission(assigner, assignee) {
  const isManagement = assigner.department?.name === 'Management' || assigner.role === 'super_admin';
  if (isManagement) return { allowed: true };

  const isSpecialManager = ['Administrator', 'Operation Manager', 'HR Manager', 'Finance Manager'].includes(assigner.position);
  if (isSpecialManager) {
    if (assignee.department?.name === 'Management') {
      return { allowed: false, error: 'You are not authorized to assign tasks to Management.' };
    }
    return { allowed: true };
  }

  const isHOD = ['Head of Department', 'Head of Development', 'Finance Manager', 'Administrator', 'Operation Manager', 'HR Manager'].includes(assigner.position);
  const isAssistantHOD = assigner.position === 'Assistant Head of Department';

  if (isHOD || isAssistantHOD) {
    if (assigner.departmentId !== assignee.departmentId) {
      const isTrainingDeptAssigner = assigner.department?.name === 'Training Department';
      const isPearlOrIreneAssignee = ['sticialstudio@gmail.com', 'irene@company.com'].includes(assignee.email);
      if (!(isTrainingDeptAssigner && isPearlOrIreneAssignee)) {
        return { allowed: false, error: 'Heads and Assistant Heads of Department can only assign tasks within their own department.' };
      }
    }
    return { allowed: true };
  }

  // Regular employees can only assign to themselves
  if (assigner.id === assignee.id) {
    return { allowed: true };
  }

  return { allowed: false, error: 'Regular employees can only create and assign tasks to themselves.' };
}

module.exports = tasksRoutes;
