const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { buildReportAutoPopulateData, ensureAutoDraft } = require('../lib/reportAutomation');

async function reportsRoutes(fastify) {
  // Helper: check if a user is in Management
  async function isManagement(userId, organizationId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { department: true }
    });
    return user && (user.role === 'super_admin' || user.role === 'admin' || (user.department && user.department.name === 'Management'));
  }

  // GET /api/reports/auto-populate
  // Queries task data, blockers, future plans, support needs, and #insight comments to prefill a report
  fastify.get('/auto-populate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user;
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    try {
      const populated = await buildReportAutoPopulateData({ userId: sub, startDate, endDate, organizationId });
      return reply.send(populated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to auto-populate report tasks', message: err.message });
    }
  });

  // POST /api/reports/auto-draft
  fastify.post('/auto-draft', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, role, organizationId } = request.user;
    const { userId, startDate, endDate } = request.body || {};

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(role);
    const targetUserId = userId || sub;
    if (userId && userId !== sub && !isAdmin) {
      return reply.code(403).send({ error: 'Only admins can auto-draft for another user' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId, status: 'active' },
      select: { id: true },
    });
    if (!targetUser) return reply.code(404).send({ error: 'User not found' });

    try {
      const result = await ensureAutoDraft({ userId: targetUserId, startDate, endDate, organizationId });
      return reply.code(result.created ? 201 : 200).send({
        success: true,
        created: result.created,
        report: result.report,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to create auto draft', message: err.message });
    }
  });

  // GET /api/reports/my-reports
  fastify.get('/my-reports', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user;
    try {
      const reports = await prisma.weeklyReport.findMany({
        where: { userId: sub, organizationId },
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
    const { sub, role, organizationId } = request.user;
    const { departmentId, employeeId, startDate, status } = request.query;

    try {
      const user = await prisma.user.findFirst({
        where: { id: sub, organizationId },
        include: { department: true }
      });

      if (!user) return reply.code(401).send({ error: 'Unauthorized' });

      const isManager = ['super_admin', 'admin'].includes(role) || (user.department && user.department.name === 'Management');
      const isDeptHead = user.position && (user.position.toLowerCase().includes('head') || user.position.toLowerCase().includes('manager'));

      if (!isManager && !isDeptHead) {
        return reply.code(403).send({ error: 'Access denied: review dashboard is only for HODs and Management' });
      }

      const whereClause = { organizationId };

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
    const { sub, role, organizationId } = request.user;

    try {
      // ── Parallelise: fetch report + fetch checker user concurrently ────────
      const [report, checker] = await Promise.all([
        prisma.weeklyReport.findFirst({
          where: { id, organizationId },
          include: {
            user: {
              select: {
                id: true, name: true, email: true, role: true,
                position: true, departmentId: true,
                department: { select: { name: true } }
              }
            },
            activities: true, roadblocks: true, plans: true,
            supportItems: true, insights: true
          }
        }),
        prisma.user.findFirst({
          where: { id: sub, organizationId },
          include: { department: true }
        }),
      ]);

      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // Auth check
      const isOwner = report.userId === sub;
      const isManager = ['super_admin', 'admin'].includes(role) || (checker?.department?.name === 'Management');
      const isDeptHead = checker?.position &&
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
    const { sub, organizationId } = request.user;
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
      let report = await prisma.weeklyReport.findFirst({
        where: {
          userId: sub,
          startDate,
          organizationId
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
            reviewNotes: '',
            organizationId
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
            links: a.links || '',
            isAutoFilled: a.isAutoFilled === true,
            sourceTaskId: a.sourceTaskId || null,
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
            deadline: rb.deadline || '',
            isAutoFilled: rb.isAutoFilled === true,
            sourceTaskId: rb.sourceTaskId || null,
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
            dependencies: p.dependencies || '',
            isAutoFilled: p.isAutoFilled === true,
            sourceTaskId: p.sourceTaskId || null,
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
            dueDate: s.dueDate || '',
            isAutoFilled: s.isAutoFilled === true,
            sourceTaskId: s.sourceTaskId || null,
          }))
        });
      }

      if (insights.length > 0) {
        await prisma.reportInsight.createMany({
          data: insights.map(ins => ({
            reportId: report.id,
            insight: ins.insight,
            category: ins.category || 'Process',
            impact: ins.impact || '',
            isAutoFilled: ins.isAutoFilled === true,
            sourceTaskId: ins.sourceTaskId || null,
          }))
        });
      }

      // Fetch completed report to return
      const finalReport = await prisma.weeklyReport.findFirst({
        where: { id: report.id, organizationId },
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
    const { sub, role, organizationId } = request.user;

    if (!['approved', 'needs_revision'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status. Must be approved or needs_revision' });
    }

    try {
      const report = await prisma.weeklyReport.findFirst({
        where: { id, organizationId },
        include: { user: true }
      });

      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // Auth check
      const reviewer = await prisma.user.findFirst({
        where: { id: sub, organizationId },
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
    const { sub, role, organizationId } = request.user;

    try {
      const report = await prisma.weeklyReport.findFirst({
        where: { id, organizationId },
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
      const checker = await prisma.user.findFirst({
        where: { id: sub, organizationId },
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

        const filename = `WeeklyReport_${report.user.name.replace(/\s+/g, '_')}_${report.startDate}.docx`;
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
