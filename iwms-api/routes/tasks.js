const prisma = require('../lib/prisma');

async function tasksRoutes(fastify) {
  // GET /api/tasks
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { status, priority, assigneeId, projectId } = request.query || {};

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
    const { title, description, assigneeId, reviewerId, priority, status, dueDate, tags, projectId, projectName, estimatedHours, departmentId } = request.body || {};

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

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        assigneeId,
        creatorId: sub,
        reviewerId: reviewerId || sub, // defaults to creator
        priority: priority || 'medium',
        status: status || 'todo',
        dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        tags: JSON.stringify(tags || []),
        projectId: projectId || 'general',
        projectName: projectName || 'General',
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

    const { title, description, assigneeId, reviewerId, priority, status, dueDate, tags, projectId, projectName, estimatedHours, loggedHours, departmentId } = request.body || {};

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
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (projectId !== undefined) updateData.projectId = projectId;
    if (projectName !== undefined) updateData.projectName = projectName;
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
      data: { loggedHours: Math.round((totalLogged._sum.hours || 0) * 10) / 10 },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } }
      }
    });

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
      userAvatar: timeLog.user.avatar
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

