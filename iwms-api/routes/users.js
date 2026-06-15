const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

function normalizeEmployeeCode(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function usersRoutes(fastify) {
  // GET /api/users
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;

    // 1. Management can see everyone
    if (['super_admin', 'admin', 'hr_manager'].includes(role)) {
      const users = await prisma.user.findMany({
        where: { organizationId },
        include: { department: true },
        orderBy: { name: 'asc' },
      });
      return reply.send(users.map(u => {
        const { passwordHash, ...safe } = u;
        return { ...safe, department: u.department?.name || '' };
      }));
    }

    // Get current user's department
    const currentUser = await prisma.user.findFirst({
      where: { id: sub, organizationId },
      select: { departmentId: true }
    });
    const departmentId = currentUser?.departmentId;

    let whereClause = { organizationId };

    if (role === 'manager') {
      // 2. HODs (managers) can see their department members OR HODs/Management
      const orConditions = [{ role: { in: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead'] } }];
      if (departmentId) {
        orConditions.push({ departmentId });
      } else {
        orConditions.push({ id: sub });
      }
      whereClause = { ...whereClause, OR: orConditions };
    } else {
      // 3. Regular employees and Team Leads can only see their department members
      if (departmentId) {
        whereClause = { ...whereClause, departmentId };
      } else {
        whereClause = { ...whereClause, id: sub };
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: { department: true },
      orderBy: { name: 'asc' },
    });

    return reply.send(users.map(u => {
      const { passwordHash, ...safe } = u;
      return { ...safe, department: u.department?.name || '' };
    }));
  });

  // GET /api/users/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { id } = request.params;

    // Fetch the target user details
    const targetUser = await prisma.user.findFirst({
      where: { id, organizationId },
      include: { department: true },
    });

    if (!targetUser) return reply.code(404).send({ error: 'User not found' });

    // Allow if requesting user is Management
    const isManagement = ['super_admin', 'admin', 'hr_manager'].includes(role);
    if (isManagement) {
      const { passwordHash, ...safe } = targetUser;
      return reply.send({ ...safe, department: targetUser.department?.name || '' });
    }

    // Fetch requesting user's department
    const currentUser = await prisma.user.findFirst({
      where: { id: sub, organizationId },
      select: { departmentId: true }
    });
    const departmentId = currentUser?.departmentId;

    let allowed = false;

    if (sub === id) {
      allowed = true;
    } else if (role === 'manager') {
      // HOD (manager) can see department members or other HODs/Management
      const isTargetHodOrMgmt = ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead'].includes(targetUser.role);
      const isSameDepartment = departmentId && targetUser.departmentId === departmentId;
      if (isTargetHodOrMgmt || isSameDepartment) {
        allowed = true;
      }
    } else {
      // Employees/Team Leads can see target user only if same department
      if (departmentId && targetUser.departmentId === departmentId) {
        allowed = true;
      }
    }

    if (!allowed) {
      return reply.code(403).send({ error: 'Access denied to this user profile' });
    }

    const { passwordHash, ...safe } = targetUser;
    return reply.send({ ...safe, department: targetUser.department?.name || '' });
  });

  // POST /api/users
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, email, password, roleName, position, phone, departmentName, joinDate, employeeCode } = request.body || {};
    const normalizedEmployeeCode = normalizeEmployeeCode(employeeCode);

    if (!name || !email || !password) {
      return reply.code(400).send({ error: 'name, email and password are required' });
    }

    const existing = await prisma.user.findFirst({ where: { email, organizationId } });
    if (existing) return reply.code(409).send({ error: 'Email already exists' });

    if (normalizedEmployeeCode) {
      const existingCode = await prisma.user.findFirst({ where: { employeeCode: normalizedEmployeeCode, organizationId } });
      if (existingCode) return reply.code(409).send({ error: 'Employee Code / RFID UID already exists' });
    }

    const dept = departmentName
      ? await prisma.department.findFirst({ where: { name: departmentName, organizationId } })
      : null;

    const avatar = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: roleName || 'employee',
        position: position || '',
        phone: phone || '',
        avatar,
        status: 'active',
        joinDate: joinDate || new Date().toISOString().split('T')[0],
        employeeCode: normalizedEmployeeCode,
        departmentId: dept?.id || null,
        organizationId,
      },
      include: { department: true },
    });

    const { passwordHash: _, ...safe } = user;
    return reply.code(201).send({ ...safe, department: user.department?.name || '' });
  });

  // PATCH /api/users/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;
    const { id } = request.params;
    const canEdit = ['super_admin', 'admin', 'hr_manager'].includes(role);

    if (!canEdit && sub !== id) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { id, organizationId }
    });
    if (!existingUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const { name, position, phone, status, roleName, departmentName, password, employeeCode } = request.body || {};
    const normalizedEmployeeCode = normalizeEmployeeCode(employeeCode);

    const dept = departmentName
      ? await prisma.department.findFirst({ where: { name: departmentName, organizationId } })
      : undefined;

    const updateData = {};
    if (name) updateData.name = name;
    if (position !== undefined) updateData.position = position;
    if (phone !== undefined) updateData.phone = phone;
    if (employeeCode !== undefined) {
      if (normalizedEmployeeCode) {
        const existingCode = await prisma.user.findFirst({
          where: { employeeCode: normalizedEmployeeCode, NOT: { id }, organizationId },
        });
        if (existingCode) return reply.code(409).send({ error: 'Employee Code / RFID UID already exists' });
      }
      updateData.employeeCode = normalizedEmployeeCode;
    }
    if (status && canEdit) updateData.status = status;
    if (roleName && canEdit) updateData.role = roleName;
    if (dept !== undefined) updateData.departmentId = dept?.id || null;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        include: { department: true },
      });

      const { passwordHash, ...safe } = user;
      return reply.send({ ...safe, department: user.department?.name || '' });
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'User not found' });
      }
      throw err;
    }
  });

  // DELETE /api/users/:id (soft delete)
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, organizationId } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const existingUser = await prisma.user.findFirst({
        where: { id: request.params.id, organizationId }
      });
      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await prisma.user.update({
        where: { id: request.params.id },
        data: { status: 'inactive' },
      });

      return reply.send({ message: 'User deactivated successfully' });
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'User not found' });
      }
      throw err;
    }
  });
}

module.exports = usersRoutes;
