const { sendMail, overtimeAlertHtml } = require('../lib/mailer');
const { currentTimeHHMM, diffHoursHHMM, isValidDeviceApiKey } = require('../lib/runtime');
const prisma = require('../lib/prisma');

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getLatenessStatus(userId, date, timeStr, organizationId) {
  const shift = await prisma.shift.findFirst({
    where: { userId, date, organizationId },
  });

  if (shift && shift.type === 'off') {
    return 'present';
  }

  const [h, m] = timeStr.split(':').map(Number);
  const mins = h * 60 + m;

  let lateThreshold = 9 * 60 + 15; // default 09:15
  if (shift && shift.startTime) {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    lateThreshold = sh * 60 + 15;
  }

  return mins > lateThreshold ? 'late' : 'present';
}

// Haversine formula to compute distance between two GPS points in metres
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function attendanceRoutes(fastify) {
  // GET /api/attendance/live-feed
  fastify.get('/live-feed', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const today = new Date().toISOString().split('T')[0];

    const records = await prisma.attendanceRecord.findMany({
      where: { date: today, organizationId },
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
            role: true,
            position: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: [{ clockIn: 'desc' }],
    });

    return reply.send(records.map(r => ({
      ...r,
      userName: r.user.name,
      userAvatar: r.user.avatar,
      userRole: r.user.role || '',
      userPosition: r.user.position || '',
      userDepartment: r.user.department?.name || '',
    })));
  });

  // GET /api/attendance/summary
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const [users, recordsToday, recordsYesterday] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'active', organizationId },
        include: { department: { select: { name: true } } }
      }),
      prisma.attendanceRecord.findMany({ where: { date: today, organizationId } }),
      prisma.attendanceRecord.findMany({ where: { date: yesterdayStr, organizationId } })
    ]);

    // Calculate KPIs
    const presentToday = recordsToday.filter(r => r.status === 'present').length;
    const lateToday = recordsToday.filter(r => r.status === 'late').length;
    const absentToday = recordsToday.filter(r => r.status === 'absent').length;
    const onLeaveToday = recordsToday.filter(r => r.status === 'on_leave').length;

    const presentYesterday = recordsYesterday.filter(r => r.status === 'present').length;
    const lateYesterday = recordsYesterday.filter(r => r.status === 'late').length;
    const absentYesterday = recordsYesterday.filter(r => r.status === 'absent').length;
    const onLeaveYesterday = recordsYesterday.filter(r => r.status === 'on_leave').length;

    const getChangePercent = (todayVal, yesterdayVal) => {
      if (yesterdayVal === 0) return todayVal > 0 ? 100 : 0;
      return Math.round(((todayVal - yesterdayVal) / yesterdayVal) * 100);
    };

    const kpis = {
      present: { value: presentToday, change: getChangePercent(presentToday, presentYesterday) },
      late: { value: lateToday, change: getChangePercent(lateToday, lateYesterday) },
      absent: { value: absentToday, change: getChangePercent(absentToday, absentYesterday) },
      onLeave: { value: onLeaveToday, change: getChangePercent(onLeaveToday, onLeaveYesterday) }
    };

    // Calculate byDepartment
    const deptMap = {};
    for (const u of users) {
      const deptName = u.department?.name || 'Unassigned';
      if (!deptMap[deptName]) {
        deptMap[deptName] = { name: deptName, present: 0, late: 0, absent: 0 };
      }
      const rec = recordsToday.find(r => r.userId === u.id);
      if (rec) {
        if (rec.status === 'present') deptMap[deptName].present++;
        else if (rec.status === 'late') deptMap[deptName].late++;
        else if (rec.status === 'absent') deptMap[deptName].absent++;
      } else {
        deptMap[deptName].absent++;
      }
    }
    const byDepartment = Object.values(deptMap);

    // Calculate byHour
    const hourCounts = {};
    for (let h = 7; h <= 18; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hourCounts[label] = 0;
    }
    for (const r of recordsToday) {
      if (r.clockIn) {
        const h = parseInt(r.clockIn.split(':')[0], 10);
        if (h >= 7 && h <= 18) {
          const label = `${String(h).padStart(2, '0')}:00`;
          hourCounts[label]++;
        }
      }
    }
    const byHour = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));

    // Top arrivals
    const sortedClockIns = recordsToday
      .filter(r => r.clockIn)
      .map(r => {
        const u = users.find(usr => usr.id === r.userId);
        return {
          id: r.userId,
          name: u?.name || 'Unknown',
          avatar: u?.avatar || '??',
          clockIn: r.clockIn,
          status: r.status
        };
      });

    const topEarlyArrivals = [...sortedClockIns]
      .filter(r => r.status === 'present')
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn))
      .slice(0, 5);

    const topLateArrivals = [...sortedClockIns]
      .filter(r => r.status === 'late')
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn))
      .slice(0, 5);

    return reply.send({
      kpis,
      byDepartment,
      byHour,
      topEarlyArrivals,
      topLateArrivals
    });
  });

  // GET /api/attendance/timesheets
  fastify.get('/timesheets', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { startDate, endDate, userId, departmentId } = request.query || {};

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    // 1. Fetch active users matching filters
    const userWhere = { organizationId, status: 'active' };
    if (userId) userWhere.id = userId;
    if (departmentId) userWhere.departmentId = departmentId;

    const users = await prisma.user.findMany({
      where: userWhere,
      include: { department: { select: { name: true } } },
      orderBy: { name: 'asc' }
    });

    // 2. Fetch all attendance records in range for these users
    const records = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        date: { gte: startDate, lte: endDate },
        userId: { in: users.map(u => u.id) }
      }
    });

    // 3. Helper to list all dates in YYYY-MM-DD format
    const getDatesInRange = (startStr, endStr) => {
      const dates = [];
      const curr = new Date(startStr);
      const end = new Date(endStr);
      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      return dates;
    };
    const dateRange = getDatesInRange(startDate, endDate);

    // 4. Map records per user
    const timesheets = users.map(user => {
      const userRecords = records.filter(r => r.userId === user.id);
      
      let totalHours = 0;
      let overtimeHours = 0;

      const days = dateRange.map(dStr => {
        const rec = userRecords.find(r => r.date === dStr);
        if (rec) {
          const hours = rec.hoursWorked || 0;
          totalHours += hours;
          if (hours > 8) {
            overtimeHours += (hours - 8);
          }
          return {
            date: dStr,
            clockIn: rec.clockIn || null,
            clockOut: rec.clockOut || null,
            hoursWorked: hours,
            status: rec.status,
            method: rec.method
          };
        } else {
          return {
            date: dStr,
            clockIn: null,
            clockOut: null,
            hoursWorked: 0,
            status: 'absent',
            method: null
          };
        }
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar || '??',
          department: user.department?.name || '',
          position: user.position || ''
        },
        days,
        totalHours,
        overtimeHours
      };
    });

    return reply.send(timesheets);
  });

  // GET /api/attendance/timesheets/export
  fastify.get('/timesheets/export', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { startDate, endDate, userId, departmentId, format } = request.query || {};

    if (!startDate || !endDate) {
      return reply.code(400).send({ error: 'startDate and endDate are required' });
    }

    // 1. Fetch active users matching filters
    const userWhere = { organizationId, status: 'active' };
    if (userId) userWhere.id = userId;
    if (departmentId) userWhere.departmentId = departmentId;

    const users = await prisma.user.findMany({
      where: userWhere,
      include: { department: { select: { name: true } } },
      orderBy: { name: 'asc' }
    });

    // 2. Fetch all attendance records in range
    const records = await prisma.attendanceRecord.findMany({
      where: {
        organizationId,
        date: { gte: startDate, lte: endDate },
        userId: { in: users.map(u => u.id) }
      }
    });

    const getDatesInRange = (startStr, endStr) => {
      const dates = [];
      const curr = new Date(startStr);
      const end = new Date(endStr);
      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      return dates;
    };
    const dateRange = getDatesInRange(startDate, endDate);

    // 3. Build timesheet rows based on format
    if (format === 'excel') {
      let xlsHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
  <style>
    table { border-collapse:collapse; }
    td, th { border:0.5pt solid #cbd5e1; font-family:Arial, sans-serif; font-size:10pt; text-align:center; padding: 6px 10px; }
    th { background-color:#f1f5f9; font-weight:bold; color:#0f172a; }
    .text-left { text-align:left; }
    .title { font-size:14pt; font-weight:bold; height:36px; text-align:left; color:#0f172a; border:none; }
    .header-info { text-align:left; color:#475569; font-size:9pt; height:24px; border:none; }
  </style>
</head>
<body>
  <table>
    <tr><td colspan="${dateRange.length + 5}" class="title">Timesheet Export Report</td></tr>
    <tr><td colspan="${dateRange.length + 5}" class="header-info">Reporting Period: ${startDate} to ${endDate}</td></tr>
    <tr><td colspan="${dateRange.length + 5}" class="header-info">Generated on: ${new Date().toLocaleString()}</td></tr>
    <tr><td colspan="${dateRange.length + 5}" style="border:none; height:12px;"></td></tr>
    <tr>
      <th>Employee</th>
      <th>Department</th>
      <th>Position</th>
      ${dateRange.map(d => `<th>${d}</th>`).join('')}
      <th>Total Hours</th>
      <th>Overtime Hours</th>
    </tr>`;

      for (const user of users) {
        const userRecords = records.filter(r => r.userId === user.id);
        let totalHours = 0;
        let overtimeHours = 0;

        let row = `<tr>
          <td class="text-left">${user.name}</td>
          <td>${user.department?.name || ''}</td>
          <td>${user.position || ''}</td>`;

        for (const dStr of dateRange) {
          const rec = userRecords.find(r => r.date === dStr);
          const hours = rec ? (rec.hoursWorked || 0) : 0;
          totalHours += hours;
          if (hours > 8) {
            overtimeHours += (hours - 8);
          }
          row += `<td>${hours > 0 ? hours.toFixed(1) : '-'}</td>`;
        }

        row += `<td><b>${totalHours.toFixed(1)}</b></td><td><b>${overtimeHours.toFixed(1)}</b></td></tr>`;
        xlsHtml += row;
      }

      xlsHtml += `</table></body></html>`;

      reply.header('Content-Type', 'application/vnd.ms-excel');
      reply.header('Content-Disposition', `attachment; filename=timesheets_${startDate}_to_${endDate}.xls`);
      return reply.send(xlsHtml);
    }

    // Default CSV formatting
    let csv = 'Employee,Department,Position,';
    csv += dateRange.join(',') + ',Total Hours,Overtime Hours\n';

    for (const user of users) {
      const userRecords = records.filter(r => r.userId === user.id);
      let totalHours = 0;
      let overtimeHours = 0;
      let rowStr = `"${user.name}","${user.department?.name || ''}","${user.position || ''}",`;

      for (const dStr of dateRange) {
        const rec = userRecords.find(r => r.date === dStr);
        const hours = rec ? (rec.hoursWorked || 0) : 0;
        totalHours += hours;
        if (hours > 8) {
          overtimeHours += (hours - 8);
        }
        rowStr += `${hours.toFixed(1)},`;
      }

      rowStr += `${totalHours.toFixed(1)},${overtimeHours.toFixed(1)}\n`;
      csv += rowStr;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=timesheets_${startDate}_to_${endDate}.csv`);
    return reply.send(csv);
  });

  // GET /api/attendance
  async function buildAttendanceWhereClause(user, query, isStats = false) {
    const { role, sub, organizationId } = user;
    const { userId, departmentId, status, date, period, startDate, endDate } = query || {};

    const whereClause = { organizationId };

    // 1. Role-based scoping
    if (['super_admin', 'admin', 'hr_manager'].includes(role)) {
      if (userId) whereClause.userId = userId;
      if (departmentId && departmentId !== 'all') {
        whereClause.user = { departmentId };
      }
    } else if (role === 'manager') {
      const currentUser = await prisma.user.findFirst({
        where: { id: sub, organizationId },
        select: { departmentId: true }
      });
      const managerDeptId = currentUser?.departmentId;

      const userConditions = [{ role: { in: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead'] } }];
      if (managerDeptId) {
        userConditions.push({ departmentId: managerDeptId });
      } else {
        userConditions.push({ id: sub });
      }

      if (userId) {
        whereClause.AND = [
          { userId },
          { user: { OR: userConditions } }
        ];
      } else {
        whereClause.user = { OR: userConditions };
      }

      // Restrict department filter to manager's own department
      if (departmentId && departmentId !== 'all') {
        if (departmentId === managerDeptId) {
          whereClause.user = { departmentId };
        } else {
          whereClause.user = { departmentId: managerDeptId };
        }
      }
    } else {
      whereClause.userId = sub;
    }

    // 2. Status filter
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // 3. Date range calculations
    let start = null;
    let end = null;
    const today = new Date();

    if (period) {
      if (period === 'today') {
        start = today.toISOString().split('T')[0];
        end = start;
      } else if (period === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        start = yesterday.toISOString().split('T')[0];
        end = start;
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);
        start = weekAgo.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 29);
        start = monthAgo.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      } else if (period === 'custom') {
        start = startDate;
        end = endDate;
      }
    } else if (date) {
      start = date;
      end = date;
    } else if (isStats) {
      start = today.toISOString().split('T')[0];
      end = start;
    }

    if (start && end) {
      whereClause.date = {
        gte: start,
        lte: end
      };
    }

    return { whereClause, start, end };
  }

  // GET /api/attendance
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { whereClause } = await buildAttendanceWhereClause(request.user, request.query, false);

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, avatar: true, email: true, role: true, position: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
    });

    return reply.send(records.map(r => ({
      ...r,
      userName: r.user.name,
      userAvatar: r.user.avatar,
      userEmail: r.user.email,
      userDepartment: r.user.department?.name || '',
      userRole: r.user.role || '',
      userPosition: r.user.position || '',
    })));
  });

  // GET /api/attendance/stats — aggregated stats for dashboard
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { organizationId } = request.user;
    const { whereClause, start, end } = await buildAttendanceWhereClause(request.user, request.query, true);

    // Calculate diffDays safely
    let diffDays = 1;
    if (start && end) {
      const sDate = new Date(start);
      const eDate = new Date(end);
      if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
        const diffTime = Math.abs(eDate - sDate);
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // Determine totalEmployees in the scoped view
    let totalEmployees = 0;
    const isSingleUserFilter = whereClause.userId || (whereClause.AND && whereClause.AND.some(c => c.userId));
    if (isSingleUserFilter) {
      totalEmployees = 1;
    } else {
      const userCountWhere = { status: 'active', organizationId };
      if (whereClause.user) {
        userCountWhere.AND = [whereClause.user];
      }
      totalEmployees = await prisma.user.count({ where: userCountWhere });
    }

    const records = await prisma.attendanceRecord.findMany({ where: whereClause });

    const present = records.filter(r => r.status === 'present').length;
    const late    = records.filter(r => r.status === 'late').length;
    const absent  = records.filter(r => r.status === 'absent').length;
    const onLeave = records.filter(r => r.status === 'on_leave').length;

    const denominator = totalEmployees * diffDays;

    return reply.send({
      date: start === end ? start : `${start} to ${end}`,
      totalEmployees,
      present,
      late,
      presentWithLate: present + late,
      absent,
      onLeave,
      notRecorded: Math.max(0, denominator - records.length),
      attendanceRate: denominator > 0 ? Math.round(((present + late) / denominator) * 100) : 0,
    });
  });

  // POST /api/attendance/clock-in
  fastify.post('/clock-in', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user;
    const { latitude, longitude, method } = request.body || {};

    const today = new Date().toISOString().split('T')[0];
    const now = currentTimeHHMM();

    // ── Parallelise: geo-fence lookup + existing record check ──────────────
    const [zones, existing] = await Promise.all([
      (latitude !== undefined && longitude !== undefined)
        ? prisma.geoFenceZone.findMany({ where: { isActive: true, organizationId } })
        : Promise.resolve([]),
      prisma.attendanceRecord.findFirst({ where: { userId: sub, date: today, organizationId } }),
    ]);

    // Geo-fence validation
    if (latitude !== undefined && longitude !== undefined && zones.length > 0) {
      let inZone = false;
      let closestZone = null;
      let closestDistance = Infinity;
      for (const zone of zones) {
        const dist = haversineDistance(latitude, longitude, zone.latitude, zone.longitude);
        if (dist < closestDistance) { closestDistance = dist; closestZone = zone; }
        if (dist <= zone.radiusMeters) { inZone = true; break; }
      }
      if (!inZone) {
        return reply.code(400).send({
          error: `Out of geo-fence zone. You are ${Math.round(closestDistance)}m away from the nearest allowed zone (${closestZone?.name}).`,
        });
      }
    }

    if (existing?.clockIn) {
      return reply.code(409).send({ error: 'Already clocked in today', record: existing });
    }

    // Determine status dynamically based on user shift schedule
    const status = await getLatenessStatus(sub, today, now, organizationId);

    // Upsert attendance record — include user + department in one query (avoids a follow-up lookup)
    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: sub, date: today } },
      update: { clockIn: now, status, method: method || 'web', latitude, longitude, organizationId },
      create: {
        userId: sub, date: today, clockIn: now, status,
        method: method || 'web', latitude, longitude, organizationId,
      },
      include: {
        user: { select: { name: true, avatar: true, role: true, position: true, department: { select: { name: true } } } },
      },
    });

    const io = global.io;
    if (io) {
      const payload = {
        userId: sub,
        userName: record.user?.name || 'Unknown',
        userAvatar: record.user?.avatar || '??',
        userDepartment: record.user?.department?.name || '',
        userRole: record.user?.role || '',
        userPosition: record.user?.position || '',
        clockIn: now,
        status,
        method: method || 'web',
        timestamp: new Date().toISOString(),
      };
      io.to(`org:${organizationId}`).emit('attendance:clockIn', payload);
      if (status === 'late') io.to(`org:${organizationId}`).emit('attendance:late', payload);
    }

    return reply.code(201).send({
      ...record,
      message: `Clocked in at ${now}`,
    });
  });

  // POST /api/attendance/clock-out
  fastify.post('/clock-out', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user;
    const today = new Date().toISOString().split('T')[0];
    const now = currentTimeHHMM();

    const existing = await prisma.attendanceRecord.findFirst({
      where: { userId: sub, date: today, organizationId },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'No clock-in record found for today' });
    }

    if (existing.clockOut) {
      return reply.code(409).send({ error: 'Already clocked out today', record: existing });
    }

    let hoursWorked = null;
    if (existing.clockIn) {
      hoursWorked = diffHoursHHMM(existing.clockIn, now);
    }

    const record = await prisma.attendanceRecord.update({
      where: { userId_date: { userId: sub, date: today } },
      data: { clockOut: now, hoursWorked },
      include: {
        user: { select: { name: true, avatar: true, role: true, position: true, department: { select: { name: true } } } },
      },
    });

    if (hoursWorked !== null && hoursWorked > 8) {
      const otHours = hoursWorked - 8;
      const existingOt = await prisma.overtimeRequest.findFirst({
        where: { userId: sub, date: today, organizationId }
      });
      if (!existingOt) {
        await prisma.overtimeRequest.create({
          data: {
            userId: sub,
            date: today,
            regularHours: 8,
            overtimeHours: otHours,
            reason: 'Auto-generated from web clock-out',
            organizationId
          }
        });
      }
    }

    // Overtime alert: > 9 hours worked — fire-and-forget, do not block the response
    if (hoursWorked !== null && hoursWorked > 9) {
      // ── Parallelise: user and manager queries ─────────────────────────────
      Promise.all([
        prisma.user.findFirst({ where: { id: sub, organizationId }, include: { department: true } }),
        prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] }, status: 'active', organizationId }, select: { email: true } }),
      ]).then(([user, managers]) => {
        const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const html = overtimeAlertHtml({
          employee: { name: user?.name, avatar: user?.avatar, department: user?.department?.name, position: user?.position },
          hoursWorked,
          date: dateStr,
        });
        for (const mgr of managers) {
          sendMail({ to: mgr.email, subject: `Overtime Alert: ${user?.name} worked ${hoursWorked.toFixed(1)}h`, html }).catch(() => {});
        }
      }).catch(() => {});
    }

    const io = global.io;
    if (io) {
      io.to(`org:${organizationId}`).emit('attendance:clockOut', {
        userId: sub,
        userName: record.user?.name || 'Unknown',
        userAvatar: record.user?.avatar || '??',
        userDepartment: record.user?.department?.name || '',
        userRole: record.user?.role || '',
        userPosition: record.user?.position || '',
        clockIn: existing.clockIn,
        clockOut: now,
        hoursWorked,
        isOvertime: hoursWorked !== null && hoursWorked > 9,
        method: record.method || 'web',
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      ...record,
      message: `Clocked out at ${now}. Hours worked: ${hoursWorked}`,
    });
  });

  // POST /api/attendance/hardware-punch  ← Pico RFID reader
  fastify.post('/hardware-punch', async (request, reply) => {
    const {
      device_id,
      uid,
      name,
      event_type,
      timestamp,
      flags = [],
      terminal_event_id,
      terminalEventId: camelTerminalEventId,
      firmware,
    } = request.body ?? {};
    const normalizedDeviceId = normalizeOptionalString(device_id);
    const normalizedUid = normalizeOptionalString(uid);
    const terminalEventId = normalizeOptionalString(terminal_event_id) || normalizeOptionalString(camelTerminalEventId);
    const normalizedFirmware = normalizeOptionalString(firmware);
    const normalizedFlags = Array.isArray(flags) ? flags : [];

    // 1. Validate required fields
    if (!normalizedDeviceId || !normalizedUid || !event_type || !timestamp) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'device_id, uid, event_type, and timestamp are required',
      });
    }

    if (!['clock_in', 'clock_out'].includes(event_type)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'event_type must be "clock_in" or "clock_out"',
      });
    }

    // 2. Verify device is registered and active
    const device = await prisma.biometricDevice.findFirst({
      where: {
        serialNumber: normalizedDeviceId,
        isActive: true
      },
    });

    if (!device) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Device "${device_id}" is not registered. Add it in IWMS Settings → Biometric Hardware.`,
      });
    }

    // Get organizationId from the registered device
    const { organizationId } = device;

    // 2a. Validate X-Device-Key (Mandatory for security)
    const incomingKey = request.headers['x-device-key'];
    const keyToCheck = Array.isArray(incomingKey) ? incomingKey[0] : incomingKey;
    if (!device.apiKeyHash || !isValidDeviceApiKey(keyToCheck, device.apiKeyHash)) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing, invalid, or unprovisioned X-Device-Key. Provision a hardware key for this terminal in IWMS Settings.',
      });
    }

    // 4. Parse timestamp up-front (needed for dedup check and existing record lookup)
    const serverDate = new Date().toISOString().split('T')[0];
    const serverTime = currentTimeHHMM();
    const [deviceDate, timePart] = timestamp.split('T');
    let date = deviceDate;
    let timeStr = timePart ? timePart.substring(0, 5) : '00:00';
    if (deviceDate !== serverDate) { date = serverDate; timeStr = serverTime; }

    // ── Stage A (parallel): mark device seen + duplicate check + employee lookup ──
    const seenUpdate = { lastSeenAt: new Date(), status: 'online' };
    if (normalizedFirmware) seenUpdate.firmwareVersion = normalizedFirmware;

    const [, duplicate, user] = await Promise.all([
      prisma.biometricDevice.update({ where: { id: device.id }, data: seenUpdate }),
      terminalEventId
        ? prisma.deviceSyncLog.findUnique({
            where: { deviceId_terminalEventId: { deviceId: device.id, terminalEventId } },
          })
        : Promise.resolve(null),
      prisma.user.findFirst({
        where: { employeeCode: normalizedUid, status: 'active', organizationId },
        include: { department: true },
      }),
    ]);

    if (duplicate) {
      return reply.code(200).send({
        success: true, duplicate: true, event_type,
        log_id: duplicate.id, processed: duplicate.processed,
        message: 'Event was already received',
      });
    }

    if (!user) {
      // Log the unknown scan so admins can investigate
      await prisma.deviceSyncLog.create({
        data: {
          deviceId:     device.id,
          employeeCode: normalizedUid,
          userId:       null,
          eventType:    event_type === 'clock_in' ? 'check_in' : 'check_out',
          eventTime:    timestamp,
          terminalEventId: terminalEventId || null,
          verificationMode: 'rfid',
          rawData:      JSON.stringify({ device_id: normalizedDeviceId, uid: normalizedUid, name, flags: normalizedFlags, terminal_event_id: terminalEventId || null, firmware: normalizedFirmware }),
          processed:    false,
        },
      });
      return reply.code(404).send({
        error: 'Employee Not Found',
        message: `No active employee with RFID uid "${normalizedUid}". Set their Employee Code in IWMS Users → Edit Profile.`,
      });
    }

    // ── Stage B (parallel): existing attendance record + shift for lateness ──
    const [existing, shift] = await Promise.all([
      prisma.attendanceRecord.findFirst({ where: { userId: user.id, date, organizationId } }),
      event_type === 'clock_in'
        ? prisma.shift.findFirst({ where: { userId: user.id, date, organizationId } })
        : Promise.resolve(null),
    ]);

    // 5. Determine late / early-leave status (inline, no extra DB call needed)
    let recordStatus = 'present';
    if (event_type === 'clock_in') {
      if (shift && shift.type === 'off') {
        recordStatus = 'present';
      } else {
        const [h, m] = timeStr.split(':').map(Number);
        const mins = h * 60 + m;
        let lateThreshold = 9 * 60 + 15;
        if (shift && shift.startTime) {
          const [sh] = shift.startTime.split(':').map(Number);
          lateThreshold = sh * 60 + 15;
        }
        recordStatus = mins > lateThreshold ? 'late' : 'present';
      }
    }

    let record;
    if (event_type === 'clock_in') {
      if (existing?.clockIn) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Already clocked in today',
        });
      }
      record = await prisma.attendanceRecord.upsert({
        where:  { userId_date: { userId: user.id, date } },
        update: { clockIn: timeStr, status: recordStatus, method: 'hardware', organizationId },
        create: {
          userId:  user.id,
          date,
          clockIn: timeStr,
          status:  recordStatus,
          method:  'hardware',
          notes:   normalizedFlags.length ? normalizedFlags.join(', ') : null,
          organizationId,
        },
      });
    } else {
      // clock_out
      if (!existing || !existing.clockIn) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'No clock-in record found for today. Please clock in first.',
        });
      }
      if (existing.clockOut) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Already clocked out today',
        });
      }

      const hoursWorked = diffHoursHHMM(existing.clockIn, timeStr);

      record = await prisma.attendanceRecord.update({
        where:  { userId_date: { userId: user.id, date } },
        data: {
          clockOut:    timeStr,
          hoursWorked,
          notes: normalizedFlags.length
            ? [(existing.notes ?? ''), normalizedFlags.join(', ')].filter(Boolean).join(' | ')
            : (existing.notes ?? undefined),
        },
      });

      if (hoursWorked !== null && hoursWorked > 8) {
        const otHours = hoursWorked - 8;
        const existingOt = await prisma.overtimeRequest.findFirst({
          where: { userId: user.id, date, organizationId }
        });
        if (!existingOt) {
          await prisma.overtimeRequest.create({
            data: {
              userId: user.id,
              date,
              regularHours: 8,
              overtimeHours: otHours,
              reason: 'Auto-generated from hardware clock-out',
              organizationId
            }
          });
        }
      }
    }

    // ── Stage C (parallel): write sync log + update device lastSyncAt ──────
    await Promise.all([
      prisma.deviceSyncLog.create({
        data: {
          deviceId:     device.id,
          employeeCode: normalizedUid,
          userId:       user.id,
          eventType:    event_type === 'clock_in' ? 'check_in' : 'check_out',
          eventTime:    timestamp,
          terminalEventId: terminalEventId || null,
          verificationMode: 'rfid',
          rawData:      JSON.stringify({ device_id: normalizedDeviceId, uid: normalizedUid, name, flags: normalizedFlags, terminal_event_id: terminalEventId || null, firmware: normalizedFirmware }),
          processed:    true,
        },
      }).catch((error) => {
        if (error.code !== 'P2002') return; // Ignore duplicate terminal_event_id retries from the Pico
        throw error;
      }),
      prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } }),
    ]);

    // 9. Emit real-time Socket.io events to the dashboard
    const io = global.io;
    if (io) {
      if (event_type === 'clock_in') {
        const payload = {
          userId:         user.id,
          userName:       user.name,
          userAvatar:     user.avatar || '??',
          userDepartment: user.department?.name || '',
          userRole:       user.role || '',
          userPosition:   user.position || '',
          clockIn:        timeStr,
          status:         recordStatus,
          method:         'hardware',
          deviceName:     device.name,
          timestamp:      new Date().toISOString(),
        };
        io.to(`org:${organizationId}`).emit('attendance:clockIn', payload);
        if (recordStatus === 'late') {
          io.to(`org:${organizationId}`).emit('attendance:late', payload);
        }
      } else {
        // clock_out
        io.to(`org:${organizationId}`).emit('attendance:clockOut', {
          userId:         user.id,
          userName:       user.name,
          userAvatar:     user.avatar || '??',
          userDepartment: user.department?.name || '',
          userRole:       user.role || '',
          userPosition:   user.position || '',
          clockIn:        existing?.clockIn || timeStr,
          clockOut:       timeStr,
          hoursWorked:    record.hoursWorked,
          isOvertime:     record.hoursWorked !== null && record.hoursWorked > 9,
          method:         'hardware',
          deviceName:     device.name,
          timestamp:      new Date().toISOString(),
        });
      }
    }

    // 10. Respond to the Pico
    return reply.code(200).send({
      success:    true,
      event_type,
      user: {
        id:   user.id,
        name: user.name,
        code: normalizedUid,
      },
      date,
      time:      timeStr,
      flags:     normalizedFlags,
      terminal_event_id: terminalEventId || null,
      record_id: record.id,
      status:    recordStatus,
      hoursWorked: record.hoursWorked,
    });
  });

  // POST /api/attendance/hardware-punch/batch  ← Pico offline queue flush
  // Accepts a JSON body: { events: [ { device_id, uid, event_type, timestamp, terminal_event_id, flags? }, ... ] }
  // Authorization: X-Device-Key header (same as single punch).
  // Strategy:
  //   1. Verify device is registered & key is valid.
  //   2. For each event in the batch:
  //      a. Skip if terminalEventId already exists in DeviceSyncLog (dedup).
  //      b. Skip if same uid + same event_type occurred within 5 min (double-tap mitigation).
  //      c. If unknown uid → log to DeviceSyncLog with processed=false, continue.
  //      d. Otherwise → upsert AttendanceRecord, emit Socket.IO, log to DeviceSyncLog.
  //   3. Return per-event result summary so the Pico knows what was accepted.
  fastify.post('/hardware-punch/batch', async (request, reply) => {
    const body = request.body ?? {};
    const events = Array.isArray(body.events) ? body.events : [];

    if (events.length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'events array is required and must not be empty' });
    }

    // Use the first event's device_id to locate the device (all events must be from the same terminal)
    const firstDeviceId = normalizeOptionalString(events[0]?.device_id);
    if (!firstDeviceId) {
      return reply.code(400).send({ error: 'Bad Request', message: 'device_id is required on each event' });
    }

    // 1. Verify device is registered and active
    const device = await prisma.biometricDevice.findFirst({
      where: { serialNumber: firstDeviceId, isActive: true },
    });

    if (!device) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Device "${firstDeviceId}" is not registered. Add it in IWMS Settings → Biometric Hardware.`,
      });
    }

    const { organizationId } = device;

    // 1a. Validate X-Device-Key
    const incomingKey = request.headers['x-device-key'];
    const keyToCheck = Array.isArray(incomingKey) ? incomingKey[0] : incomingKey;
    if (!device.apiKeyHash || !isValidDeviceApiKey(keyToCheck, device.apiKeyHash)) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing, invalid, or unprovisioned X-Device-Key.',
      });
    }

    // Mark device as online (fire-and-forget)
    prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), lastSyncAt: new Date(), status: 'online' },
    }).catch(() => {});

    const serverDate = new Date().toISOString().split('T')[0];
    const serverTime = currentTimeHHMM();
    const io = global.io;

    // Track what we've seen THIS batch to handle double-taps within the batch itself
    // key: `${uid}:${event_type}` → ISO timestamp string of the most recent event in the batch we processed
    const batchRecentEvents = new Map();

    const results = [];

    for (const ev of events) {
      const normalizedUid       = normalizeOptionalString(ev.uid);
      const event_type          = (ev.event_type || '').trim();
      const rawTerminalEventId  = normalizeOptionalString(ev.terminal_event_id || ev.terminalEventId);
      const normalizedFlags     = Array.isArray(ev.flags) ? ev.flags : [];
      const evTimestamp         = (ev.timestamp || '').trim();

      // Basic field validation
      if (!normalizedUid || !event_type || !evTimestamp) {
        results.push({ terminal_event_id: rawTerminalEventId || null, status: 'skipped', reason: 'Missing uid, event_type, or timestamp' });
        continue;
      }
      if (!['clock_in', 'clock_out'].includes(event_type)) {
        results.push({ terminal_event_id: rawTerminalEventId || null, status: 'skipped', reason: `Invalid event_type: ${event_type}` });
        continue;
      }

      // Parse timestamp
      const [deviceDate, timePart] = evTimestamp.split('T');
      let date    = deviceDate;
      let timeStr = timePart ? timePart.substring(0, 5) : '00:00';
      if (deviceDate !== serverDate) { date = serverDate; timeStr = serverTime; }

      // 2a. Dedup check against DeviceSyncLog
      if (rawTerminalEventId) {
        const existing = await prisma.deviceSyncLog.findUnique({
          where: { deviceId_terminalEventId: { deviceId: device.id, terminalEventId: rawTerminalEventId } },
        });
        if (existing) {
          results.push({ terminal_event_id: rawTerminalEventId, status: 'duplicate', reason: 'Already received', log_id: existing.id });
          continue;
        }
      }

      // 2b. Double-tap mitigation — within-batch: same uid + same event_type within 5 min
      const tapKey = `${normalizedUid}:${event_type}`;
      const lastSeen = batchRecentEvents.get(tapKey);
      if (lastSeen) {
        const diffMs = Math.abs(new Date(evTimestamp).getTime() - new Date(lastSeen).getTime());
        if (diffMs < 5 * 60 * 1000) {
          results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, status: 'skipped', reason: 'Double-tap within 5 min (in-batch)' });
          continue;
        }
      }
      // Also check against the DB for events that may have been processed in a previous flush
      const recentDbLog = await prisma.deviceSyncLog.findFirst({
        where: {
          deviceId:  device.id,
          employeeCode: normalizedUid,
          eventType: event_type === 'clock_in' ? 'check_in' : 'check_out',
          processed: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentDbLog) {
        const diffMs = Math.abs(new Date(evTimestamp).getTime() - new Date(recentDbLog.createdAt).getTime());
        if (diffMs < 5 * 60 * 1000) {
          results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, status: 'skipped', reason: 'Double-tap within 5 min (DB)' });
          continue;
        }
      }

      // 2c. Look up employee
      const user = await prisma.user.findFirst({
        where: { employeeCode: normalizedUid, status: 'active', organizationId },
        include: { department: true },
      });

      if (!user) {
        // Log unknown card for admin visibility, but don't fail the whole batch
        await prisma.deviceSyncLog.create({
          data: {
            deviceId:     device.id,
            employeeCode: normalizedUid,
            userId:       null,
            eventType:    event_type === 'clock_in' ? 'check_in' : 'check_out',
            eventTime:    evTimestamp,
            terminalEventId: rawTerminalEventId || null,
            verificationMode: 'rfid',
            rawData:      JSON.stringify({ uid: normalizedUid, event_type, timestamp: evTimestamp, flags: normalizedFlags }),
            processed:    false,
          },
        }).catch(() => {});
        results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, status: 'unknown_card', reason: 'No active employee with this RFID uid' });
        continue;
      }

      // 2d. Process valid punch
      try {
        let record;
        let recordStatus = 'present';

        if (event_type === 'clock_in') {
          // Lateness check
          const shift = await prisma.shift.findFirst({ where: { userId: user.id, date, organizationId } });
          if (!shift || shift.type !== 'off') {
            const [h, m] = timeStr.split(':').map(Number);
            const mins = h * 60 + m;
            let lateThreshold = 9 * 60 + 15;
            if (shift?.startTime) {
              const [sh] = shift.startTime.split(':').map(Number);
              lateThreshold = sh * 60 + 15;
            }
            recordStatus = mins > lateThreshold ? 'late' : 'present';
          }

          const existingRecord = await prisma.attendanceRecord.findFirst({ where: { userId: user.id, date, organizationId } });
          if (existingRecord?.clockIn) {
            results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, name: user.name, status: 'already_clocked_in', reason: 'Already clocked in today' });
            continue;
          }

          record = await prisma.attendanceRecord.upsert({
            where:  { userId_date: { userId: user.id, date } },
            update: { clockIn: timeStr, status: recordStatus, method: 'hardware', organizationId },
            create: { userId: user.id, date, clockIn: timeStr, status: recordStatus, method: 'hardware', notes: normalizedFlags.join(', ') || null, organizationId },
          });

          if (io) {
            const payload = {
              userId: user.id, userName: user.name, userAvatar: user.avatar || '??',
              userDepartment: user.department?.name || '', userRole: user.role || '', userPosition: user.position || '',
              clockIn: timeStr, status: recordStatus, method: 'hardware', deviceName: device.name,
              timestamp: new Date().toISOString(),
            };
            io.to(`org:${organizationId}`).emit('attendance:clockIn', payload);
            if (recordStatus === 'late') io.to(`org:${organizationId}`).emit('attendance:late', payload);
          }
        } else {
          // clock_out
          const existingRecord = await prisma.attendanceRecord.findFirst({ where: { userId: user.id, date, organizationId } });
          if (!existingRecord?.clockIn) {
            results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, name: user.name, status: 'no_clock_in', reason: 'No clock-in record found for today' });
            continue;
          }
          if (existingRecord?.clockOut) {
            results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, name: user.name, status: 'already_clocked_out', reason: 'Already clocked out today' });
            continue;
          }

          const hoursWorked = diffHoursHHMM(existingRecord.clockIn, timeStr);
          record = await prisma.attendanceRecord.update({
            where: { userId_date: { userId: user.id, date } },
            data:  { clockOut: timeStr, hoursWorked },
          });

          // Auto-create overtime request if applicable
          if (hoursWorked !== null && hoursWorked > 8) {
            const existingOt = await prisma.overtimeRequest.findFirst({ where: { userId: user.id, date, organizationId } });
            if (!existingOt) {
              await prisma.overtimeRequest.create({
                data: { userId: user.id, date, regularHours: 8, overtimeHours: hoursWorked - 8, reason: 'Auto-generated from hardware batch clock-out', organizationId },
              }).catch(() => {});
            }
          }

          if (io) {
            io.to(`org:${organizationId}`).emit('attendance:clockOut', {
              userId: user.id, userName: user.name, userAvatar: user.avatar || '??',
              userDepartment: user.department?.name || '', userRole: user.role || '', userPosition: user.position || '',
              clockIn: existingRecord.clockIn, clockOut: timeStr, hoursWorked: record.hoursWorked,
              isOvertime: record.hoursWorked !== null && record.hoursWorked > 9,
              method: 'hardware', deviceName: device.name, timestamp: new Date().toISOString(),
            });
          }
        }

        // Write sync log
        await prisma.deviceSyncLog.create({
          data: {
            deviceId:     device.id,
            employeeCode: normalizedUid,
            userId:       user.id,
            eventType:    event_type === 'clock_in' ? 'check_in' : 'check_out',
            eventTime:    evTimestamp,
            terminalEventId: rawTerminalEventId || null,
            verificationMode: 'rfid',
            rawData:      JSON.stringify({ uid: normalizedUid, event_type, timestamp: evTimestamp, flags: normalizedFlags }),
            processed:    true,
          },
        }).catch((err) => { if (err.code !== 'P2002') throw err; });

        // Mark in batch window
        batchRecentEvents.set(tapKey, evTimestamp);

        results.push({
          terminal_event_id: rawTerminalEventId || null,
          uid: normalizedUid,
          name: user.name,
          status: 'accepted',
          event_type,
          date,
          time: timeStr,
          record_id: record.id,
          attendance_status: recordStatus,
        });
      } catch (err) {
        results.push({ terminal_event_id: rawTerminalEventId || null, uid: normalizedUid, status: 'error', reason: err.message });
      }
    }

    const accepted = results.filter(r => r.status === 'accepted').length;
    const skipped  = results.filter(r => ['skipped', 'duplicate', 'unknown_card', 'already_clocked_in', 'already_clocked_out', 'no_clock_in'].includes(r.status)).length;
    const errors   = results.filter(r => r.status === 'error').length;

    return reply.code(200).send({
      success: true,
      summary: { total: events.length, accepted, skipped, errors },
      results,
    });
  });

  // GET /api/attendance/presence — real-time team presence view
  fastify.get('/presence', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub, organizationId } = request.user;

    // Build user query based on role
    const userWhere = { status: 'active', organizationId };

    if (role === 'manager') {
      // Managers only see their own department
      const currentUser = await prisma.user.findFirst({
        where: { id: sub, organizationId },
        select: { departmentId: true }
      });
      if (currentUser?.departmentId) {
        userWhere.departmentId = currentUser.departmentId;
      } else {
        // Manager with no department — only see themselves
        userWhere.id = sub;
      }
    } else if (!['super_admin', 'admin', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const today = new Date().toISOString().split('T')[0];

    const [users, todayRecords] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          avatar: true,
          position: true,
          role: true,
          department: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.attendanceRecord.findMany({
        where: { date: today, organizationId },
        select: {
          userId: true,
          status: true,
          clockIn: true,
          clockOut: true,
          hoursWorked: true,
          method: true
        }
      })
    ]);

    const recordMap = new Map(todayRecords.map(r => [r.userId, r]));

    const presence = users.map(user => {
      const rec = recordMap.get(user.id);
      return {
        userId: user.id,
        name: user.name,
        avatar: user.avatar || '??',
        position: user.position || '',
        role: user.role,
        departmentId: user.department?.id || null,
        department: user.department?.name || 'Unassigned',
        status: rec ? rec.status : 'not_clocked_in',
        clockIn: rec?.clockIn || null,
        clockOut: rec?.clockOut || null,
        hoursWorked: rec?.hoursWorked || null,
        method: rec?.method || null
      };
    });

    // Summary counts
    const summary = {
      total: presence.length,
      present: presence.filter(p => p.status === 'present').length,
      late: presence.filter(p => p.status === 'late').length,
      absent: presence.filter(p => p.status === 'absent').length,
      onLeave: presence.filter(p => p.status === 'on_leave').length,
      notClockedIn: presence.filter(p => p.status === 'not_clocked_in').length
    };

    return reply.send({ presence, summary, date: today });
  });

  // PATCH /api/attendance/:id — manual correction (admin/HR only)
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, email, organizationId } = request.user;
    if (!['super_admin', 'admin', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { clockIn, clockOut, status, method, notes, correctionReason } = request.body || {};

    const existing = await prisma.attendanceRecord.findFirst({
      where: { id: request.params.id, organizationId }
    });
    if (!existing) {
      return reply.code(404).send({ error: 'Attendance record not found' });
    }

    const updateData = {};
    if (clockIn !== undefined) updateData.clockIn = clockIn;
    if (clockOut !== undefined) updateData.clockOut = clockOut;
    if (status !== undefined) updateData.status = status;
    if (method !== undefined) updateData.method = method;
    if (notes !== undefined) updateData.notes = notes;

    if (clockIn !== undefined || clockOut !== undefined) {
      updateData.correctedIn = existing.correctedIn || existing.clockIn || '';
      updateData.correctedOut = existing.correctedOut || existing.clockOut || '';
      updateData.correctionReason = correctionReason || 'No reason provided';
      updateData.correctedBy = email;
    }

    const finalClockIn  = clockIn  !== undefined ? clockIn  : existing.clockIn;
    const finalClockOut = clockOut !== undefined ? clockOut : existing.clockOut;

    if (finalClockIn && finalClockOut) {
      updateData.hoursWorked = diffHoursHHMM(finalClockIn, finalClockOut);
    } else {
      updateData.hoursWorked = null;
    }

    const record = await prisma.attendanceRecord.update({
      where: { id: request.params.id },
      data: updateData,
    });

    if (global.io) {
      global.io.to(`org:${organizationId}`).emit('attendance:updated', {
        id:       record.id,
        userId:   record.userId,
        date:     record.date,
        status:   record.status,
        clockIn:  record.clockIn,
        clockOut: record.clockOut,
      });
    }

    return reply.send(record);
  });
}

module.exports = attendanceRoutes;
