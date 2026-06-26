const prisma = require('./prisma');

function toDateBoundary(date, endOfDay = false) {
  return new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function mapTaskStatus(status) {
  if (status === 'done') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'review') return 'Under Review';
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
  const today = new Date().toISOString().split('T')[0];

  const [timeLogs, allAssignedTasks, insightComments] = await Promise.all([
    // Time logs for the reporting week
    prisma.taskTimeLog.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        task: { organizationId },
      },
      include: { task: true },
    }),

    // ALL tasks assigned to this user — we slice them into sections below
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        organizationId,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        timeLogs: {
          where: { userId, date: { gte: startDate, lte: endDate } },
          select: { hours: true },
        },
      },
    }),

    // Comments marked as insights in the reporting week
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

  // ── Helpers ────────────────────────────────────────────────────────────
  const taskHoursFromLogs = new Map();
  const loggedTaskIds = new Set();
  for (const log of timeLogs) {
    if (!log.task) continue;
    taskHoursFromLogs.set(log.taskId, (taskHoursFromLogs.get(log.taskId) || 0) + log.hours);
    loggedTaskIds.add(log.taskId);
  }

  function hoursForTask(task) {
    const inlineHours = (task.timeLogs || []).reduce((s, l) => s + (Number(l.hours) || 0), 0);
    return Math.round((inlineHours || taskHoursFromLogs.get(task.id) || 0) * 10) / 10;
  }

  function isOverdue(task) {
    return task.dueDate && task.dueDate < today && task.status !== 'done';
  }

  function typeFromTask(task) {
    return task.department?.name || task.projectName || 'General';
  }

  // ── Section 1: Activities ──────────────────────────────────────────────
  // Tasks that had time logged this week OR were actively worked on (in_progress / review / done)
  // during the reporting window based on updatedAt timestamp.
  const activityTasks = allAssignedTasks.filter(task => {
    const hasLog = loggedTaskIds.has(task.id) || hoursForTask(task) > 0;
    const updatedStr = task.updatedAt
      ? new Date(task.updatedAt).toISOString().split('T')[0]
      : null;
    const workedThisWeek =
      updatedStr &&
      updatedStr >= startDate &&
      updatedStr <= endDate &&
      ['in_progress', 'review', 'done'].includes(task.status);
    return hasLog || workedThisWeek;
  });

  const activities = activityTasks.map(task => ({
    taskName: task.title,
    type: typeFromTask(task),
    status: mapTaskStatus(task.status),
    impact: task.outcomeImpact || '',
    hoursSpent: hoursForTask(task),
    links: task.deliverableLink || '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  // ── Section 2: Challenges & Roadblocks ────────────────────────────────
  // Sources (in priority):
  //   a) Tasks with an explicit blockerNote (highest signal)
  //   b) Tasks overdue and stuck in backlog / todo / in_progress
  //   c) Tasks stuck in 'review' past their due date
  const seenRoadblockIds = new Set();
  const roadblocks = [];

  for (const task of allAssignedTasks) {
    if (seenRoadblockIds.has(task.id)) continue;

    const hasBlockerNote = String(task.blockerNote || '').trim().length > 0;
    const isStuck =
      isOverdue(task) && ['backlog', 'todo', 'in_progress'].includes(task.status);
    const isStuckInReview = task.status === 'review' && isOverdue(task);

    if (!hasBlockerNote && !isStuck && !isStuckInReview) continue;

    let challenge, impact, mitigation, supportRequired;

    if (hasBlockerNote) {
      challenge = task.blockerNote;
      impact = `Blocking progress on "${task.title}"`;
      mitigation = 'Under review — awaiting resolution';
      supportRequired = task.reviewer?.name
        ? `Support from ${task.reviewer.name}`
        : 'Team support needed';
    } else if (isStuckInReview) {
      challenge = `"${task.title}" is awaiting review and has passed its deadline`;
      impact = 'Delayed sign-off is blocking next steps and timeline';
      mitigation = 'Escalate to reviewer for timely feedback';
      supportRequired = task.reviewer?.name
        ? `Review from ${task.reviewer.name}`
        : 'Reviewer feedback required';
    } else {
      challenge = `"${task.title}" is overdue and not yet completed`;
      impact = 'Required additional time; potential project timeline impact';
      mitigation = 'Prioritizing completion in next reporting period';
      supportRequired = '';
    }

    seenRoadblockIds.add(task.id);
    roadblocks.push({
      challenge,
      impact,
      mitigation,
      supportRequired,
      responsibleParty: task.assignee?.name || '',
      deadline: task.dueDate || '',
      isAutoFilled: true,
      sourceTaskId: task.id,
    });
  }

  // ── Section 3: Upcoming Plans (Next Reporting Period) ─────────────────
  // All tasks NOT yet done — these represent what the person will work on next week.
  // Sorted: todo first → in_progress → backlog → review, then by dueDate ascending.
  const notDoneTasks = allAssignedTasks.filter(t => t.status !== 'done');
  const planOrder = { todo: 0, in_progress: 1, backlog: 2, review: 3 };
  notDoneTasks.sort((a, b) => {
    const ao = planOrder[a.status] ?? 4;
    const bo = planOrder[b.status] ?? 4;
    if (ao !== bo) return ao - bo;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const plans = notDoneTasks.map(task => ({
    plannedActivity: task.title,
    typeAssigned: 'Assigned',
    typeScope:
      task.department?.name === 'Management' ? 'Cross-Departmental' : 'Departmental',
    deliverables: task.outcomeImpact || task.deliverableLink || '',
    targetDate: task.dueDate || '',
    dependencies: String(task.blockerNote || '').trim()
      ? `Blocked: ${task.blockerNote}`
      : '',
    isAutoFilled: true,
    sourceTaskId: task.id,
  }));

  // ── Section 4: Support & Action Items ─────────────────────────────────
  // Sources:
  //   a) Tasks with blockerNote → explicit support request
  //   b) Tasks in 'review' → need reviewer action / feedback
  //   c) Overdue high/critical priority tasks → escalation needed
  const seenSupportIds = new Set();
  const supportItems = [];

  for (const task of allAssignedTasks) {
    if (seenSupportIds.has(task.id)) continue;

    const hasBlockerNote = String(task.blockerNote || '').trim().length > 0;
    const needsReview = task.status === 'review';
    const isUrgentOverdue =
      isOverdue(task) && ['high', 'critical'].includes(task.priority);

    if (!hasBlockerNote && !needsReview && !isUrgentOverdue) continue;

    let description, supportType, requestedFrom;

    if (hasBlockerNote) {
      description = `Support needed: ${task.blockerNote}`;
      supportType = 'Technical';
      requestedFrom = task.reviewer?.name || 'Management';
    } else if (needsReview) {
      description = `Review of "${task.title}" — task completed, awaiting sign-off`;
      supportType = 'Technical and strategic feedback';
      requestedFrom = task.reviewer?.name || 'Supervisor/Management';
    } else {
      description = `Urgent escalation: "${task.title}" is overdue and high priority`;
      supportType = 'Management decision';
      requestedFrom = 'Management';
    }

    seenSupportIds.add(task.id);
    supportItems.push({
      description,
      supportType,
      requestedFrom,
      urgency: mapUrgency(task.priority),
      dueDate: task.dueDate || '',
      isAutoFilled: true,
      sourceTaskId: task.id,
    });
  }

  // ── Section 5: Insights ────────────────────────────────────────────────
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
