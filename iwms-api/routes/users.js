const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

function normalizeEmployeeCode(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function usersRoutes(fastify) {
  // GET /api/users
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub } = request.user;
    const canViewAll = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(role);

    const users = await prisma.user.findMany({
      where: canViewAll ? {} : { id: sub },
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
    const { role, sub } = request.user;
    const { id } = request.params;
    const canViewAll = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(role);

    if (!canViewAll && sub !== id) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!user) return reply.code(404).send({ error: 'User not found' });
    const { passwordHash, ...safe } = user;
    return reply.send({ ...safe, department: user.department?.name || '' });
  });

  // POST /api/users
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, email, password, roleName, position, phone, departmentName, joinDate, employeeCode } = request.body || {};
    const normalizedEmployeeCode = normalizeEmployeeCode(employeeCode);

    if (!name || !email || !password) {
      return reply.code(400).send({ error: 'name, email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: 'Email already exists' });

    if (normalizedEmployeeCode) {
      const existingCode = await prisma.user.findFirst({ where: { employeeCode: normalizedEmployeeCode } });
      if (existingCode) return reply.code(409).send({ error: 'Employee Code / RFID UID already exists' });
    }

    const dept = departmentName
      ? await prisma.department.findFirst({ where: { name: departmentName } })
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
      },
      include: { department: true },
    });

    const { passwordHash: _, ...safe } = user;
    return reply.code(201).send({ ...safe, department: user.department?.name || '' });
  });

  // PATCH /api/users/:id
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub } = request.user;
    const { id } = request.params;
    const canEdit = ['super_admin', 'admin', 'hr_manager'].includes(role);

    if (!canEdit && sub !== id) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { name, position, phone, status, roleName, departmentName, password, employeeCode } = request.body || {};
    const normalizedEmployeeCode = normalizeEmployeeCode(employeeCode);

    const dept = departmentName
      ? await prisma.department.findFirst({ where: { name: departmentName } })
      : undefined;

    const updateData = {};
    if (name) updateData.name = name;
    if (position !== undefined) updateData.position = position;
    if (phone !== undefined) updateData.phone = phone;
    if (employeeCode !== undefined) {
      if (normalizedEmployeeCode) {
        const existingCode = await prisma.user.findFirst({
          where: { employeeCode: normalizedEmployeeCode, NOT: { id } },
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
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
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
