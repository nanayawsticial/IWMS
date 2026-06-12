const { sendMail, overtimeAlertHtml } = require('../lib/mailer');
const { currentTimeHHMM, diffHoursHHMM, isValidDeviceApiKey } = require('../lib/runtime');
const prisma = require('../lib/prisma');

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getLatenessStatus(userId, date, timeStr) {
  const shift = await prisma.shift.findUnique({
    where: { userId_date: { userId, date } },
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
  // GET /api/attendance
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, sub } = request.user;
    const { date, status, userId } = request.query || {};

    const whereClause = {};

    if (['super_admin', 'admin', 'hr_manager'].includes(role)) {
      // Management can view all records, and filter by specific user
      if (userId) whereClause.userId = userId;
    } else if (role === 'manager') {
      // HODs (managers) can view department members' records OR other HODs/Management
      const currentUser = await prisma.user.findUnique({
        where: { id: sub },
        select: { departmentId: true }
      });
      const departmentId = currentUser?.departmentId;

      const userConditions = [{ role: { in: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead'] } }];
      if (departmentId) {
        userConditions.push({ departmentId });
      } else {
        userConditions.push({ id: sub });
      }

      if (userId) {
        // If filtering by a specific user, ensure that user matches HOD's allowed scope
        whereClause.AND = [
          { userId },
          { user: { OR: userConditions } }
        ];
      } else {
        whereClause.user = { OR: userConditions };
      }
    } else {
      // Employees/Team Leads can only view their own attendance records
      whereClause.userId = sub;
    }

    if (date) whereClause.date = date;
    if (status) whereClause.status = status;

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, avatar: true, email: true, department: { select: { name: true } } },
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
    })));
  });

  // GET /api/attendance/stats — aggregated stats for dashboard
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { date } = request.query || {};
    const targetDate = date || new Date().toISOString().split('T')[0];

    const records = await prisma.attendanceRecord.findMany({ where: { date: targetDate } });
    const totalUsers = await prisma.user.count({ where: { status: 'active' } });

    const present = records.filter(r => r.status === 'present').length;
    const late    = records.filter(r => r.status === 'late').length;
    const absent  = records.filter(r => r.status === 'absent').length;
    const onLeave = records.filter(r => r.status === 'on_leave').length;

    return reply.send({
      date: targetDate,
      totalEmployees: totalUsers,
      present,
      late,
      presentWithLate: present + late,
      absent,
      onLeave,
      notRecorded: totalUsers - records.length,
      attendanceRate: totalUsers > 0 ? Math.round(((present + late) / totalUsers) * 100) : 0,
    });
  });

  // POST /api/attendance/clock-in
  fastify.post('/clock-in', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    const { latitude, longitude, method } = request.body || {};

    // Validate geo-fence if lat/lng are provided
    if (latitude !== undefined && longitude !== undefined) {
      const zones = await prisma.geoFenceZone.findMany({ where: { isActive: true } });
      if (zones.length > 0) {
        let inZone = false;
        let closestZone = null;
        let closestDistance = Infinity;

        for (const zone of zones) {
          const dist = haversineDistance(latitude, longitude, zone.latitude, zone.longitude);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestZone = zone;
          }
          if (dist <= zone.radiusMeters) {
            inZone = true;
            break;
          }
        }

        if (!inZone) {
          return reply.code(400).send({
            error: `Out of geo-fence zone. You are ${Math.round(closestDistance)}m away from the nearest allowed zone (${closestZone?.name}).`,
          });
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const now = currentTimeHHMM();

    // Check if already clocked in today
    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: sub, date: today } },
    });

    if (existing?.clockIn) {
      return reply.code(409).send({ error: 'Already clocked in today', record: existing });
    }

    // Determine status dynamically based on user shift schedule
    const status = await getLatenessStatus(sub, today, now);

    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: sub, date: today } },
      update: { clockIn: now, status, method: method || 'web', latitude, longitude },
      create: {
        userId: sub,
        date: today,
        clockIn: now,
        status,
        method: method || 'web',
        latitude,
        longitude,
      },
      include: {
        user: { select: { name: true, avatar: true } },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: sub },
      include: { department: true },
    });

    const io = global.io;
    if (io) {
      const payload = {
        userId: sub,
        userName: user?.name || 'Unknown',
        userAvatar: user?.avatar || '??',
        userDepartment: user?.department?.name || '',
        clockIn: now,
        status,
        method: method || 'web',
        timestamp: new Date().toISOString(),
      };
      io.emit('attendance:clockIn', payload);
      if (status === 'late') io.emit('attendance:late', payload);
    }

    return reply.code(201).send({
      ...record,
      message: `Clocked in at ${now}`,
    });
  });

  // POST /api/attendance/clock-out
  fastify.post('/clock-out', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user;
    const today = new Date().toISOString().split('T')[0];
    const now = currentTimeHHMM();

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: sub, date: today } },
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
    });

    // Overtime alert: > 9 hours worked
    if (hoursWorked !== null && hoursWorked > 9) {
      const user = await prisma.user.findUnique({
        where: { id: sub },
        include: { department: true },
      });
      const managers = await prisma.user.findMany({
        where: { role: { in: ['admin', 'manager'] }, status: 'active' },
        select: { email: true },
      });
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const html = overtimeAlertHtml({
        employee: { name: user?.name, avatar: user?.avatar, department: user?.department?.name, position: user?.position },
        hoursWorked,
        date: dateStr,
      });
      for (const mgr of managers) {
        sendMail({ to: mgr.email, subject: `Overtime Alert: ${user?.name} worked ${hoursWorked.toFixed(1)}h`, html }).catch(() => {});
      }
    }

    const io = global.io;
    if (io) {
      io.emit('attendance:clockOut', {
        userId: sub,
        clockOut: now,
        hoursWorked,
        isOvertime: hoursWorked !== null && hoursWorked > 9,
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

    // 2. Verify device is registered and active (lookup by either database ID or serial number)
    const device = await prisma.biometricDevice.findFirst({
      where: {
        OR: [
          { id: normalizedDeviceId },
          { serialNumber: normalizedDeviceId }
        ],
        isActive: true
      },
    });

    if (!device) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Device "${device_id}" is not registered. Add it in IWMS Settings → Biometric Hardware.`,
      });
    }

    // 2a. Validate X-Device-Key (Mandatory for security)
    const incomingKey = request.headers['x-device-key'];
    const keyToCheck = Array.isArray(incomingKey) ? incomingKey[0] : incomingKey;
    if (!device.apiKeyHash || !isValidDeviceApiKey(keyToCheck, device.apiKeyHash)) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing, invalid, or unprovisioned X-Device-Key. Provision a hardware key for this terminal in IWMS Settings.',
      });
    }

    // Mark device as seen
    const seenUpdate = { lastSeenAt: new Date(), status: 'online' };
    if (normalizedFirmware) seenUpdate.firmwareVersion = normalizedFirmware;
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: seenUpdate,
    });

    if (terminalEventId) {
      const duplicate = await prisma.deviceSyncLog.findUnique({
        where: { deviceId_terminalEventId: { deviceId: device.id, terminalEventId } },
      });

      if (duplicate) {
        return reply.code(200).send({
          success: true,
          duplicate: true,
          event_type,
          log_id: duplicate.id,
          processed: duplicate.processed,
          message: 'Event was already received',
        });
      }
    }

    // 3. Look up employee by employeeCode (= RFID uid)
    const user = await prisma.user.findFirst({
      where: { employeeCode: normalizedUid, status: 'active' },
      include: { department: true },
    });

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

    // 4. Parse date ("2026-06-08") and time ("09:15") from ISO timestamp
    const [date, timePart] = timestamp.split('T');
    const timeStr = timePart ? timePart.substring(0, 5) : '00:00';

    // 5. Determine late / early-leave status dynamically
    let recordStatus = 'present';
    if (event_type === 'clock_in') {
      recordStatus = await getLatenessStatus(user.id, date, timeStr);
    }

    // 6. Fetch existing record and check constraints
    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });

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
        update: { clockIn: timeStr, status: recordStatus, method: 'hardware' },
        create: {
          userId:  user.id,
          date,
          clockIn: timeStr,
          status:  recordStatus,
          method:  'hardware',
          notes:   normalizedFlags.length ? normalizedFlags.join(', ') : null,
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
    }

    // 7. Write to DeviceSyncLog
    await prisma.deviceSyncLog.create({
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
      if (error.code !== 'P2002') throw error;
      // Ignore duplicate terminal_event_id retries from the Pico.
    });

    // 8. Update device lastSyncAt
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data:  { lastSyncAt: new Date() },
    });

    // 9. Emit real-time Socket.io events to the dashboard
    const io = global.io;
    if (io) {
      if (event_type === 'clock_in') {
        const payload = {
          userId:         user.id,
          userName:       user.name,
          userAvatar:     user.avatar || '??',
          userDepartment: user.department?.name || '',
          clockIn:        timeStr,
          status:         recordStatus,
          method:         'hardware',
          deviceName:     device.name,
          timestamp:      new Date().toISOString(),
        };
        io.emit('attendance:clockIn', payload);
        if (recordStatus === 'late') {
          io.emit('attendance:late', payload);
        }
      } else {
        // clock_out
        io.emit('attendance:clockOut', {
          userId:         user.id,
          userName:       user.name,
          userAvatar:     user.avatar || '??',
          userDepartment: user.department?.name || '',
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

  // PATCH /api/attendance/:id — manual correction (admin/HR only)
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role, email } = request.user;
    if (!['super_admin', 'admin', 'hr_manager'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { clockIn, clockOut, status, method, notes, correctionReason } = request.body || {};

    const existing = await prisma.attendanceRecord.findUnique({
      where: { id: request.params.id }
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
      global.io.emit('attendance:updated', {
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
