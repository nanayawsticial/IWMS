const prisma = require('./prisma');

function toDateBoundary(date, endOfDay = false) {
  return new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function mapTaskStatus(status) {
  if (status === 'done') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'backlog' || status === 'blocked') return 'Blocked';
  return 'Pending';
}

function mapUrgency(priority) {
  if (priority === 'high' || priority === 'critical') return 'high';
  if (priority === 'low') return 'low';
  return 'medium';
}

function stripInsightPrefix(content) {
  return String(content || '').replace(/^#insight\s*/i, '').trim();
}

function sectionCreateData(items, reportId) {
  return items.map(item => ({ ...item, reportId }));
}

async function buildReportAutoPopulateData({ userId, startDate, endDate, organizationId }) {
  const [timeLogs, blockerTasks, planTasks, insightComments] = await Promise.all([
    prisma.taskTimeLog.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        task: { organizationId },
      },
      include: { task: true },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        organizationId,
        blockerNote: { not: null },
        status: { in: ['todo', 'in_progress', 'review'] },
      },
      include: {
        assignee: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        organizationId,
        status: { in: ['todo', 'in_progress'] },
        dueDate: { gt: endDate },
      },
    }),
    prisma.taskComment.findMany({
      where: {
        createdAt: {
          gte: toDateBoundary(startDate),
          lte: toDateBoundary(endDate, true),
        },
        content: { startsWith: '#insight', mode: 'insensitive' },
        task: {
          organizationId,
          assigneeId: userId,
        },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const taskHours = new Map();
  const loggedTasks = new Map();
  for (const log of timeLogs) {
    if (!log.task) continue;
    taskHours.set(log.taskId, (taskHours.get(log.taskId) || 0) + log.hours);
    loggedTasks.set(log.taskId, log.task);
  }

  const activities = Array.from(loggedTasks.values()).map(task => ({
    taskName: task.title,
    type: task.projectName || 'General',
    status: mapTaskStatus(task.status),
    impact: task.outcomeImpact || '',
    hoursSpent: Math.round((taskHours.get(task.id) || 0) * 10) / 10,
    links: task.deliverableLink || '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  const blockerTasksWithNote = blockerTasks.filter(task => String(task.blockerNote || '').trim());

  const roadblocks = blockerTasksWithNote.map(task => ({
    challenge: task.blockerNote || '',
    impact: `Impact of delay on ${task.title}`,
    mitigation: '',
    supportRequired: '',
    responsibleParty: task.assignee?.name || '',
    deadline: task.dueDate || '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  const plans = planTasks.map(task => ({
    plannedActivity: task.title,
    typeAssigned: 'Assigned',
    typeScope: 'Departmental',
    deliverables: task.deliverableLink || '',
    targetDate: task.dueDate || '',
    dependencies: '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  const supportItems = blockerTasksWithNote.map(task => ({
    description: `Support needed: ${task.blockerNote}`,
    supportType: 'Technical',
    requestedFrom: task.reviewer?.name || '',
    urgency: mapUrgency(task.priority),
    dueDate: task.dueDate || '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  const insights = insightComments
    .map(comment => ({
      insight: stripInsightPrefix(comment.content),
      category: 'Process',
      impact: '',
      isAutoFilled: true,
      sourceTaskId: comment.taskId,
    }))
    .filter(item => item.insight);

  return { activities, roadblocks, plans, supportItems, insights };
}

async function getWeeklyReportWithSections(id, organizationId) {
  return prisma.weeklyReport.findFirst({
    where: { id, organizationId },
    include: {
      activities: true,
      roadblocks: true,
      plans: true,
      supportItems: true,
      insights: true,
    },
  });
}

async function ensureAutoDraft({ userId, startDate, endDate, organizationId }) {
  const existing = await prisma.weeklyReport.findFirst({
    where: { userId, startDate, organizationId },
    include: {
      activities: true,
      roadblocks: true,
      plans: true,
      supportItems: true,
      insights: true,
    },
  });

  if (existing) {
    return { report: existing, created: false };
  }

  const populated = await buildReportAutoPopulateData({ userId, startDate, endDate, organizationId });
  const report = await prisma.weeklyReport.create({
    data: {
      userId,
      startDate,
      endDate,
      status: 'draft',
      isAutoDraft: true,
      additionalNotes: '',
      reviewNotes: '',
      organizationId,
      activities: { create: populated.activities },
      roadblocks: { create: populated.roadblocks },
      plans: { create: populated.plans },
      supportItems: { create: populated.supportItems },
      insights: { create: populated.insights },
    },
    include: {
      activities: true,
      roadblocks: true,
      plans: true,
      supportItems: true,
      insights: true,
    },
  });

  return { report, created: true };
}

function getPreviousWeekRange(referenceDate = new Date()) {
  const current = new Date(referenceDate);
  const day = current.getDay();
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
  const thisMonday = new Date(current.setDate(diffToMonday));
  thisMonday.setHours(0, 0, 0, 0);

  const previousMonday = new Date(thisMonday);
  previousMonday.setDate(thisMonday.getDate() - 7);

  const previousSunday = new Date(previousMonday);
  previousSunday.setDate(previousMonday.getDate() + 6);

  return {
    startDate: previousMonday.toISOString().split('T')[0],
    endDate: previousSunday.toISOString().split('T')[0],
  };
}

module.exports = {
  buildReportAutoPopulateData,
  ensureAutoDraft,
  getPreviousWeekRange,
  getWeeklyReportWithSections,
  sectionCreateData,
};
