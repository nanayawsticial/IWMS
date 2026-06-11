const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function reportsRoutes(fastify) {
  // Helper: check if a user is in Management
  async function isManagement(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true }
    });
    return user && (user.role === 'super_admin' || user.role === 'admin' || (user.department && user.department.name === 'Management'));
  }

  // GET /api/reports/auto-populate
  // Queries active tasks and weekly hours logged by the user to prefill activities
  fastify.get('/auto-populate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    try {
      // 1. Get tasks where user logged hours in the date range
      const timeLogs = await prisma.taskTimeLog.findMany({
        where: {
          userId: sub,
          date: { gte: startDate, lte: endDate }
        },
        include: { task: true }
      });

      // Sum hours per task
      const taskHours = {};
      const loggedTasks = [];
      const seenTaskIds = new Set();

      for (const log of timeLogs) {
        if (log.task) {
          taskHours[log.taskId] = (taskHours[log.taskId] || 0) + log.hours;
          if (!seenTaskIds.has(log.taskId)) {
            seenTaskIds.add(log.taskId);
            loggedTasks.push(log.task);
          }
        }
      }

      // 2. Get active tasks assigned to the user that are NOT completed but might not have logs yet
      const activeTasks = await prisma.task.findMany({
        where: {
          assigneeId: sub,
          status: { in: ['todo', 'in_progress', 'review'] }
        }
      });

      // Merge logged tasks and active tasks
      const allTasks = [...loggedTasks];
      for (const t of activeTasks) {
        if (!seenTaskIds.has(t.id)) {
          seenTaskIds.add(t.id);
          allTasks.push(t);
        }
      }

      // Format activities for weekly report
      const activities = allTasks.map(t => {
        // Map DB task status to report status
        let status = 'Pending';
        if (t.status === 'done') status = 'Completed';
        else if (t.status === 'in_progress') status = 'In Progress';
        else if (t.status === 'review') status = 'Pending';
        else if (t.status === 'backlog') status = 'Blocked';

        return {
          taskName: t.title,
          type: t.projectName || 'General',
          status,
          impact: '',
          hoursSpent: taskHours[t.id] || 0,
          links: ''
        };
      });

      return reply.send({ activities });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to auto-populate report tasks', message: err.message });
    }
  });

  // GET /api/reports/my-reports
  fastify.get('/my-reports', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    try {
      const reports = await prisma.weeklyReport.findMany({
        where: { userId: sub },
        orderBy: { startDate: 'desc' }
      });
      return reply.send(reports);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to fetch reports', message: err.message });
    }
  });

  // GET /api/reports/review-list
  // HODs and Management reviewing reports
  fastify.get('/review-list', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, role } = request.user;
    const { departmentId, employeeId, startDate, status } = request.query;

    try {
      const user = await prisma.user.findUnique({
        where: { id: sub },
        include: { department: true }
      });

      if (!user) return reply.code(401).send({ error: 'Unauthorized' });

      const isManager = ['super_admin', 'admin'].includes(role) || (user.department && user.department.name === 'Management');
      const isDeptHead = user.position && (user.position.toLowerCase().includes('head') || user.position.toLowerCase().includes('manager'));

      if (!isManager && !isDeptHead) {
        return reply.code(403).send({ error: 'Access denied: review dashboard is only for HODs and Management' });
      }

      const whereClause = {};

      // Restrict HODs to their own department only
      if (!isManager && isDeptHead) {
        whereClause.user = {
          departmentId: user.departmentId
        };
      } else if (departmentId) {
        whereClause.user = {
          departmentId: departmentId
        };
      }

      // Filter by specific employee if selected
      if (employeeId) {
        whereClause.userId = employeeId;
      }

      // Filter by start date
      if (startDate) {
        whereClause.startDate = startDate;
      }

      // Filter by status (submitted, approved, needs_revision)
      if (status) {
        whereClause.status = status;
      } else {
        // By default, show submitted/approved/needs_revision, hide drafts unless requested
        whereClause.status = { in: ['submitted', 'approved', 'needs_revision'] };
      }

      const reports = await prisma.weeklyReport.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
              position: true,
              department: { select: { name: true } }
            }
          }
        },
        orderBy: { startDate: 'desc' }
      });

      return reply.send(reports);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch review reports list', message: err.message });
    }
  });

  // GET /api/reports/:id
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { sub, role } = request.user;

    try {
      const report = await prisma.weeklyReport.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              position: true,
              departmentId: true,
              department: { select: { name: true } }
            }
          },
          activities: true,
          roadblocks: true,
          plans: true,
          supportItems: true,
          insights: true
        }
      });

      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // Auth check
      const isOwner = report.userId === sub;
      const checker = await prisma.user.findUnique({
        where: { id: sub },
        include: { department: true }
      });

      const isManager = ['super_admin', 'admin'].includes(role) || (checker.department && checker.department.name === 'Management');
      const isDeptHead = checker.position && 
        (checker.position.toLowerCase().includes('head') || checker.position.toLowerCase().includes('manager')) &&
        checker.departmentId === report.user.departmentId;

      if (!isOwner && !isManager && !isDeptHead) {
        return reply.code(403).send({ error: 'Access denied to view this report' });
      }

      return reply.send(report);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to fetch report details', message: err.message });
    }
  });

  // POST /api/reports/draft (or /api/reports/submit)
  // Saves report as draft or submits it
  fastify.post('/save', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    const {
      startDate,
      endDate,
      additionalNotes,
      activities = [],
      roadblocks = [],
      plans = [],
      supportItems = [],
      insights = [],
      action // 'draft' or 'submit'
    } = request.body || {};

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    try {
      // Find existing report for this user & start date
      let report = await prisma.weeklyReport.findUnique({
        where: {
          userId_startDate: { userId: sub, startDate }
        }
      });

      // If report already exists and is submitted/approved, it cannot be modified
      // unless status is needs_revision
      if (report && ['submitted', 'approved'].includes(report.status)) {
        return reply.code(400).send({ error: 'Cannot modify a submitted or approved report.' });
      }

      const status = action === 'submit' ? 'submitted' : 'draft';

      if (report) {
        // Update report metadata
        report = await prisma.weeklyReport.update({
          where: { id: report.id },
          data: {
            endDate,
            status,
            additionalNotes: additionalNotes || '',
            reviewNotes: '' // Clear review notes on update/resubmission
          }
        });

        // Delete existing relations
        await prisma.reportActivity.deleteMany({ where: { reportId: report.id } });
        await prisma.reportRoadblock.deleteMany({ where: { reportId: report.id } });
        await prisma.reportUpcomingPlan.deleteMany({ where: { reportId: report.id } });
        await prisma.reportSupportItem.deleteMany({ where: { reportId: report.id } });
        await prisma.reportInsight.deleteMany({ where: { reportId: report.id } });
      } else {
        // Create new report
        report = await prisma.weeklyReport.create({
          data: {
            userId: sub,
            startDate,
            endDate,
            status,
            additionalNotes: additionalNotes || '',
            reviewNotes: ''
          }
        });
      }

      // Re-create relations in bulk
      if (activities.length > 0) {
        await prisma.reportActivity.createMany({
          data: activities.map(a => ({
            reportId: report.id,
            taskName: a.taskName,
            type: a.type || 'General',
            status: a.status || 'Pending',
            impact: a.impact || '',
            hoursSpent: parseFloat(a.hoursSpent) || 0,
            links: a.links || ''
          }))
        });
      }

      if (roadblocks.length > 0) {
        await prisma.reportRoadblock.createMany({
          data: roadblocks.map(rb => ({
            reportId: report.id,
            challenge: rb.challenge,
            impact: rb.impact || '',
            mitigation: rb.mitigation || '',
            supportRequired: rb.supportRequired || '',
            responsibleParty: rb.responsibleParty || '',
            deadline: rb.deadline || ''
          }))
        });
      }

      if (plans.length > 0) {
        await prisma.reportUpcomingPlan.createMany({
          data: plans.map(p => ({
            reportId: report.id,
            plannedActivity: p.plannedActivity,
            typeAssigned: p.typeAssigned || 'Assigned',
            typeScope: p.typeScope || 'Departmental',
            deliverables: p.deliverables || '',
            targetDate: p.targetDate || '',
            dependencies: p.dependencies || ''
          }))
        });
      }

      if (supportItems.length > 0) {
        await prisma.reportSupportItem.createMany({
          data: supportItems.map(s => ({
            reportId: report.id,
            description: s.description,
            supportType: s.supportType || '',
            requestedFrom: s.requestedFrom || '',
            urgency: s.urgency || 'medium',
            dueDate: s.dueDate || ''
          }))
        });
      }

      if (insights.length > 0) {
        await prisma.reportInsight.createMany({
          data: insights.map(ins => ({
            reportId: report.id,
            insight: ins.insight,
            category: ins.category || 'Process',
            impact: ins.impact || ''
          }))
        });
      }

      // Fetch completed report to return
      const finalReport = await prisma.weeklyReport.findUnique({
        where: { id: report.id },
        include: {
          activities: true,
          roadblocks: true,
          plans: true,
          supportItems: true,
          insights: true
        }
      });

      return reply.code(201).send(finalReport);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to save weekly report', message: err.message });
    }
  });

  // POST /api/reports/:id/review
  // Approve or send back for revision
  fastify.post('/:id/review', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { status, reviewNotes } = request.body || {};
    const { sub, role } = request.user;

    if (!['approved', 'needs_revision'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status. Must be approved or needs_revision' });
    }

    try {
      const report = await prisma.weeklyReport.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // Auth check
      const reviewer = await prisma.user.findUnique({
        where: { id: sub },
        include: { department: true }
      });

      const isManager = ['super_admin', 'admin'].includes(role) || (reviewer.department && reviewer.department.name === 'Management');
      const isDeptHead = reviewer.position && 
        (reviewer.position.toLowerCase().includes('head') || reviewer.position.toLowerCase().includes('manager')) &&
        reviewer.departmentId === report.user.departmentId;

      if (!isManager && !isDeptHead) {
        return reply.code(403).send({ error: 'Access denied: only HODs or Management can review reports' });
      }

      const updated = await prisma.weeklyReport.update({
        where: { id },
        data: {
          status,
          reviewNotes: reviewNotes || ''
        }
      });

      return reply.send(updated);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to submit review', message: err.message });
    }
  });

  // GET /api/reports/:id/export
  // Generate and download DOCX file
  fastify.get('/:id/export', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { sub, role } = request.user;

    try {
      const report = await prisma.weeklyReport.findUnique({
        where: { id },
        include: {
          user: {
            include: { department: true }
          },
          activities: true,
          roadblocks: true,
          plans: true,
          supportItems: true,
          insights: true
        }
      });

      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // Auth check
      const checker = await prisma.user.findUnique({
        where: { id: sub },
        include: { department: true }
      });

      const isOwner = report.userId === sub;
      const isManager = ['super_admin', 'admin'].includes(role) || (checker.department && checker.department.name === 'Management');
      const isDeptHead = checker.position && 
        (checker.position.toLowerCase().includes('head') || checker.position.toLowerCase().includes('manager')) &&
        checker.departmentId === report.user.departmentId;

      if (!isOwner && !isManager && !isDeptHead) {
        return reply.code(403).send({ error: 'Access denied to export this report' });
      }

      // Compile JSON payload for template
      const payload = {
        startDate: report.startDate || '',
        endDate: report.endDate || '',
        reportDate: report.updatedAt ? report.updatedAt.toISOString().split('T')[0] : '',
        preparedBy: report.user.name || '',
        department: report.user.department ? report.user.department.name : 'General',
        activities: (report.activities || []).map(a => ({
          taskName: a.taskName || '',
          type: a.type || '',
          status: a.status || '',
          impact: a.impact || '',
          hoursSpent: a.hoursSpent || 0,
          links: a.links || ''
        })),
        roadblocks: (report.roadblocks || []).map(r => ({
          challenge: r.challenge || '',
          impact: r.impact || '',
          mitigation: r.mitigation || '',
          supportRequired: r.supportRequired || '',
          responsibleParty: r.responsibleParty || '',
          deadline: r.deadline || ''
        })),
        plans: (report.plans || []).map(p => ({
          plannedActivity: p.plannedActivity || '',
          typeAssigned: p.typeAssigned || '',
          typeScope: p.typeScope || '',
          deliverables: p.deliverables || '',
          targetDate: p.targetDate || '',
          dependencies: p.dependencies || ''
        })),
        supportItems: (report.supportItems || []).map(s => ({
          description: s.description || '',
          supportType: s.supportType || '',
          requestedFrom: s.requestedFrom || '',
          urgency: s.urgency || '',
          dueDate: s.dueDate || ''
        })),
        insights: (report.insights || []).map(i => ({
          insight: i.insight || '',
          category: i.category || '',
          impact: i.impact || ''
        })),
        additionalNotes: report.additionalNotes || ''
      };

      try {
        const PizZip = require('pizzip');
        const Docxtemplater = require('docxtemplater');

        const templatePath = path.join(__dirname, '../templates/report_template.docx');
        const templateContent = fs.readFileSync(templatePath, 'binary');

        const zip = new PizZip(templateContent);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        doc.render(payload);

        const buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });

        const filename = `Weekly_Report_${report.startDate}_${report.user.name.replace(/\s+/g, '_')}.docx`;
        return reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buf);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Failed to generate Word document', message: err.message });
      }
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Export failed', message: err.message });
    }
  });
}

module.exports = reportsRoutes;
