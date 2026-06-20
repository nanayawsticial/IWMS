const prisma = require('../lib/prisma');

async function financeRoutes(fastify) {
  // Authentication & authorization helper
  const verifyFinanceAccess = async (request, reply) => {
    const isFinance = await isFinanceUser(request.user);
    if (!isFinance) {
      return reply.code(403).send({ error: 'Forbidden: Restricted to Finance department or administrator roles' });
    }
  };

  const isFinanceUser = async (user) => {
    if (!user) return false;
    if (['super_admin', 'admin'].includes(user.role)) {
      return true;
    }
    if (user.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: user.departmentId }
      });
      if (dept) {
        const name = dept.name.toLowerCase();
        if (name.includes('finance')) {
          return true;
        }
      }
    }
    if (user.department && typeof user.department === 'string') {
      const name = user.department.toLowerCase();
      if (name.includes('finance')) {
        return true;
      }
    }
    return false;
  };

  // GET /api/finance/dashboard
  fastify.get('/dashboard', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Get budgets for current period
    const budgetsList = await prisma.budget.findMany({
      where: { organizationId, period }
    });

    const totalBudget = budgetsList.reduce((sum, b) => sum + b.amount, 0);

    // Get expenses for current month
    const expensesList = await prisma.expense.findMany({
      where: {
        organizationId,
        date: { gte: startOfMonth }
      }
    });

    const approvedExpenses = expensesList.filter(e => ['approved', 'paid'].includes(e.status));
    const totalSpent = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = totalBudget - totalSpent;
    const expenseCountThisMonth = approvedExpenses.length;
    const pendingApprovalsCount = expensesList.filter(e => e.status === 'pending').length;

    // Expenses by category
    const categories = { salary: 0, operations: 0, equipment: 0, travel: 0, other: 0 };
    approvedExpenses.forEach(e => {
      if (e.category in categories) {
        categories[e.category] += e.amount;
      } else {
        categories.other += e.amount;
      }
    });

    const expensesByCategory = Object.keys(categories).map(k => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: categories[k]
    })).filter(c => c.value > 0);

    // 6-month spending trend
    const monthlySpendingTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = d.toLocaleString('en-US', { month: 'short' });
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString().split('T')[0];

      const mExpenses = await prisma.expense.findMany({
        where: {
          organizationId,
          status: { in: ['approved', 'paid'] },
          date: { gte: mStart, lte: mEnd }
        }
      });
      const mTotal = mExpenses.reduce((sum, e) => sum + e.amount, 0);
      monthlySpendingTrend.push({ name: mLabel, value: mTotal });
    }

    // Budget utilization
    const budgetsData = budgetsList.map(b => ({
      id: b.id,
      name: b.name,
      allocated: b.amount,
      spent: b.spent,
      remaining: b.amount - b.spent,
      pct: b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
    }));

    return reply.send({
      totalBudget,
      totalSpent,
      remaining,
      expenseCountThisMonth,
      expensesByCategory,
      monthlySpendingTrend,
      budgetsData,
      pendingApprovalsCount
    });
  });

  // GET /api/finance/expenses
  fastify.get('/expenses', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId, role, sub } = request.user;
    const { status, category, startDate, endDate } = request.query || {};

    const isManager = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(role);

    const whereClause = { organizationId };

    if (!isManager) {
      whereClause.submittedBy = sub;
    }
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true, avatar: true } } },
      orderBy: { date: 'desc' }
    });

    return reply.send(expenses.map(e => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      currency: e.currency,
      category: e.category,
      submittedBy: e.submittedBy,
      userName: e.user?.name || 'Unknown',
      userEmail: e.user?.email || '',
      status: e.status,
      receiptUrl: e.receiptUrl,
      notes: e.notes,
      date: e.date,
      createdAt: e.createdAt
    })));
  });

  // POST /api/finance/expenses
  fastify.post('/expenses', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId, sub } = request.user;
    const { title, amount, category, date, notes, receiptUrl } = request.body || {};

    if (!title || !amount || !category || !date) {
      return reply.code(400).send({ error: 'Title, amount, category, and date are required' });
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount: parseFloat(amount),
        category,
        date,
        notes: notes || '',
        receiptUrl: receiptUrl || null,
        submittedBy: sub,
        status: 'pending',
        organizationId
      }
    });

    return reply.code(201).send(expense);
  });

  // PATCH /api/finance/expenses/:id
  fastify.patch('/expenses/:id', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId, sub } = request.user;
    const { id } = request.params;
    const { status, approvedBy } = request.body || {};

    if (!status || !['approved', 'rejected', 'paid', 'pending'].includes(status)) {
      return reply.code(400).send({ error: 'Valid status is required' });
    }

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId }
    });

    if (!expense) {
      return reply.code(404).send({ error: 'Expense request not found' });
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        status,
        approvedBy: sub
      }
    });

    // If approved or marked paid, update the corresponding budget Spent amount
    if (status === 'approved' || status === 'paid') {
      const expMonth = expense.date.substring(0, 7); // YYYY-MM
      const budget = await prisma.budget.findFirst({
        where: {
          organizationId,
          period: expMonth,
          category: expense.category
        }
      });
      if (budget) {
        await prisma.budget.update({
          where: { id: budget.id },
          data: { spent: { increment: expense.amount } }
        });
      }
    }

    return reply.send(updatedExpense);
  });

  // GET /api/finance/budgets
  fastify.get('/budgets', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { period } = request.query || {};

    const whereClause = { organizationId };
    if (period) whereClause.period = period;

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      orderBy: { category: 'asc' }
    });

    return reply.send(budgets);
  });

  // POST /api/finance/budgets
  fastify.post('/budgets', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { name, amount, period, category } = request.body || {};

    if (!name || !amount || !period || !category) {
      return reply.code(400).send({ error: 'Name, amount, period, and category are required' });
    }

    // Upsert budget to avoid duplicate categories in the same period
    const existing = await prisma.budget.findFirst({
      where: { organizationId, period, category }
    });

    let budget;
    if (existing) {
      budget = await prisma.budget.update({
        where: { id: existing.id },
        data: { amount: parseFloat(amount), name }
      });
    } else {
      budget = await prisma.budget.create({
        data: {
          name,
          amount: parseFloat(amount),
          period,
          category,
          spent: 0,
          organizationId
        }
      });
    }

    return reply.code(201).send(budget);
  });

  // PATCH /api/finance/budgets/:id
  fastify.patch('/budgets/:id', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;
    const { name, amount, spent } = request.body || {};

    const budget = await prisma.budget.findFirst({
      where: { id, organizationId }
    });

    if (!budget) {
      return reply.code(404).send({ error: 'Budget not found' });
    }

    const updated = await prisma.budget.update({
      where: { id },
      data: {
        name,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        spent: spent !== undefined ? parseFloat(spent) : undefined
      }
    });

    return reply.send(updated);
  });

  // GET /api/finance/payroll-summary
  fastify.get('/payroll-summary', { onRequest: [fastify.authenticate, verifyFinanceAccess] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { period } = request.query || {}; // YYYY-MM

    const now = new Date();
    const targetPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = `${targetPeriod}-01`;
    const endOfMonth = `${targetPeriod}-31`;

    const activeUsers = await prisma.user.findMany({
      where: { organizationId, status: 'active' },
      include: { employeeProfile: true, department: true }
    });

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        date: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    const payroll = activeUsers.map(u => {
      const profile = u.employeeProfile;
      const baseSalary = profile?.salary || 3500; // fallback base GHS 3,500
      const type = profile?.employmentType || 'full_time';

      const userAttendance = attendanceRecords.filter(r => r.userId === u.id);
      const daysWorked = userAttendance.filter(r => ['present', 'late'].includes(r.status)).length;
      const daysAbsent = userAttendance.filter(r => r.status === 'absent').length;

      // Simple payroll formula: base - (absent * daily rate)
      const workingDaysInMonth = 22;
      const dailyRate = baseSalary / workingDaysInMonth;
      const absentDeduction = daysAbsent * dailyRate;
      const netPay = Math.max(0, baseSalary - absentDeduction);

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        department: u.department?.name || 'General',
        employmentType: type === 'full_time' ? 'Full Time' : type === 'part_time' ? 'Part Time' : type === 'contract' ? 'Contract' : 'Intern',
        baseSalary,
        daysWorked,
        daysAbsent,
        netPay: Math.round(netPay * 100) / 100
      };
    });

    return reply.send(payroll);
  });
}

module.exports = financeRoutes;
