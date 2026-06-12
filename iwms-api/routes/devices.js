const prisma = require('../lib/prisma');
const net = require('net');
const crypto = require('crypto');
const { parseBoolean, diffHoursHHMM, hashDeviceApiKey, isValidDeviceApiKey } = require('../lib/runtime');

// Simulate device type → brand display name
const DEVICE_BRAND = {
  zkteco: 'ZKTeco',
  hikvision: 'Hikvision',
  pico2w: 'Pico 2 W',
  generic: 'Generic',
};

function generateDeviceApiKey() {
  return `iwms_live_${crypto.randomBytes(24).toString('hex')}`;
}

function getDeviceKey(request) {
  const header = request.headers['x-device-key'];
  return Array.isArray(header) ? header[0] : header;
}

// TCP connectivity helper for real biometric terminal checks
function pingRealDevice(ip, port, timeout = 2500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'offline';
    let latencyMs = null;
    const start = Date.now();

    socket.setTimeout(timeout);

    socket.connect(port, ip, () => {
      latencyMs = Date.now() - start;
      status = 'online';
      socket.destroy();
    });

    socket.on('error', () => {
      resolve({ status: 'offline', latencyMs: null });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ status: 'offline', latencyMs: null });
    });

    socket.on('close', () => {
      resolve({ status, latencyMs });
    });
  });
}

async function processDeviceLogs(logsToProcess) {
  let processedCount = 0;

  for (const log of logsToProcess) {
    let uId = log.userId;

    if (!uId && log.employeeCode) {
      const u = await prisma.user.findFirst({ where: { employeeCode: log.employeeCode } });
      if (u) {
        uId = u.id;
        await prisma.deviceSyncLog.update({ where: { id: log.id }, data: { userId: u.id } });
      }
    }

    if (uId) {
      const eventDate = log.eventTime.split('T')[0];
      const dateObj = new Date(log.eventTime);
      const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: uId, date: eventDate } }
      });

      if (log.eventType === 'check_in') {
        const [h, m] = timeStr.split(':').map(Number);
        const minutesSinceMidnight = h * 60 + m;
        const lateThreshold = 9 * 60 + 15;
        const status = minutesSinceMidnight > lateThreshold ? 'late' : 'present';

        if (!existingRecord || !existingRecord.clockIn) {
          await prisma.attendanceRecord.upsert({
            where: { userId_date: { userId: uId, date: eventDate } },
            update: { clockIn: timeStr, status, method: 'biometric' },
            create: {
              userId: uId,
              date: eventDate,
              clockIn: timeStr,
              status,
              method: 'biometric'
            }
          });
        }
      } else if (log.eventType === 'check_out') {
        let clockInTime = existingRecord?.clockIn;
        let hoursWorked = null;
        if (clockInTime) {
          hoursWorked = diffHoursHHMM(clockInTime, timeStr);
        }

        await prisma.attendanceRecord.upsert({
          where: { userId_date: { userId: uId, date: eventDate } },
          update: { clockOut: timeStr, hoursWorked, method: 'biometric' },
          create: {
            userId: uId,
            date: eventDate,
            clockOut: timeStr,
            method: 'biometric',
            hoursWorked
          }
        });
      }

      processedCount++;
    }

    await prisma.deviceSyncLog.update({
      where: { id: log.id },
      data: { processed: true }
    });
  }

  return processedCount;
}

async function devicesRoutes(fastify) {
  async function authenticateHardwareDevice(request, reply) {
    const { id } = request.params;
    const apiKey = getDeviceKey(request);
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing X-Device-Key header' });
    }

    const device = await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device || !device.isActive) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    if (!isValidDeviceApiKey(apiKey, device.apiKeyHash)) {
      return reply.code(401).send({ error: 'Invalid device key' });
    }

    request.hardwareDevice = device;
    request.deviceAuthSource = 'device';
  }

  async function authenticateDeviceOrUser(request, reply) {
    if (getDeviceKey(request)) {
      return authenticateHardwareDevice(request, reply);
    }

    try {
      await request.jwtVerify();
      request.deviceAuthSource = 'user';
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Provide a user token or X-Device-Key' });
    }
  }

  // ── GET /api/devices ──────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const devices = await prisma.biometricDevice.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { syncLogs: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send(devices.map(d => ({
      id: d.id,
      name: d.name,
      ipAddress: d.ipAddress,
      port: d.port,
      deviceType: d.deviceType,
      brand: DEVICE_BRAND[d.deviceType] || d.deviceType,
      location: d.location,
      serialNumber: d.serialNumber,
      firmwareVersion: d.firmwareVersion,
      hardwareModel: d.hardwareModel,
      status: d.status,
      lastSyncAt: d.lastSyncAt,
      lastSeenAt: d.lastSeenAt,
      apiKeyLast4: d.apiKeyLast4,
      apiKeyCreatedAt: d.apiKeyCreatedAt,
      isActive: d.isActive,
      isSimulated: d.isSimulated,
      notes: d.notes,
      totalEvents: d._count.syncLogs,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })));
  });

  // ── POST /api/devices ─────────────────────────────────────────
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Only Super Admin or Admin can register devices' });
    }

    const { name, ipAddress, port, deviceType, location, serialNumber, firmwareVersion, hardwareModel, notes, isSimulated } = request.body || {};
    if (!name || !ipAddress) {
      return reply.code(400).send({ error: 'name and ipAddress are required' });
    }

    const device = await prisma.biometricDevice.create({
      data: {
        name,
        ipAddress,
        port: port ? parseInt(port) : 4370,
        deviceType: deviceType || 'zkteco',
        location: location || '',
        serialNumber: serialNumber || '',
        firmwareVersion: firmwareVersion || '',
        hardwareModel: hardwareModel || '',
        notes: notes || '',
        status: 'unknown',
        isSimulated: isSimulated !== undefined ? parseBoolean(isSimulated) : true,
      },
    });

    // Broadcast device added
    if (global.io) global.io.emit('device:added', { id: device.id, name: device.name });

    return reply.code(201).send(device);
  });

  // ── PATCH /api/devices/:id ────────────────────────────────────
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { id } = request.params;
    const data = request.body || {};

    // Sanitize allowed fields
    const allowed = ['name', 'ipAddress', 'port', 'deviceType', 'location', 'serialNumber', 'firmwareVersion', 'hardwareModel', 'notes', 'isActive', 'isSimulated'];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (updateData.port) updateData.port = parseInt(updateData.port);
    if (updateData.isActive !== undefined) updateData.isActive = parseBoolean(updateData.isActive);
    if (updateData.isSimulated !== undefined) updateData.isSimulated = parseBoolean(updateData.isSimulated);

    try {
      const updated = await prisma.biometricDevice.update({
        where: { id },
        data: updateData,
      });

      return reply.send(updated);
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Device not found' });
      }
      throw err;
    }
  });

  // ── POST /api/devices/:id/provision-key ───────────────────────
  // Generates a one-time key for a physical terminal such as Pico 2 W.
  fastify.post('/:id/provision-key', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { id } = request.params;
    const device = await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device || !device.isActive) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    const apiKey = generateDeviceApiKey();
    const apiKeyLast4 = apiKey.slice(-4);
    const updated = await prisma.biometricDevice.update({
      where: { id },
      data: {
        apiKeyHash: hashDeviceApiKey(apiKey),
        apiKeyLast4,
        apiKeyCreatedAt: new Date(),
        isSimulated: false,
      },
    });

    return reply.send({
      id: updated.id,
      name: updated.name,
      apiKey,
      apiKeyLast4,
      message: 'Store this device key on the terminal now. It will not be shown again.'
    });
  });

  // ── DELETE /api/devices/:id ───────────────────────────────────
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { id } = request.params;
    // Soft delete
    try {
      await prisma.biometricDevice.update({ where: { id }, data: { isActive: false } });

      if (global.io) global.io.emit('device:removed', { id });
      return reply.send({ success: true });
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Device not found' });
      }
      throw err;
    }
  });

  // ── POST /api/devices/:id/ping ────────────────────────────────
  // Connectivity test (simulated or active TCP)
  fastify.post('/:id/ping', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const device = await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    let newStatus = 'offline';
    let latencyMs = null;
    let message = '';

    if (device.isSimulated) {
      const isOnline = device.status === 'online';
      latencyMs = isOnline ? Math.floor(Math.random() * 25) + 4 : null;
      newStatus = isOnline ? 'online' : 'offline';
      message = isOnline
        ? `[SIMULATED] Device responded in ${latencyMs}ms`
        : '[SIMULATED] No response — device appears offline';
    } else if (device.deviceType === 'pico2w') {
      const now = new Date();
      const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt) : null;
      const isRecent = lastSeen && (now - lastSeen < 120 * 1000); // seen within last 2 minutes
      newStatus = isRecent ? 'online' : 'offline';
      latencyMs = isRecent ? 12 : null;
      message = isRecent
        ? `Pico terminal active/seen recently at ${lastSeen.toLocaleTimeString()}`
        : 'Pico terminal has not checked in or sent a punch recently';
    } else {
      const res = await pingRealDevice(device.ipAddress, device.port);
      newStatus = res.status;
      latencyMs = res.latencyMs;
      message = newStatus === 'online'
        ? `Live device connected successfully in ${latencyMs}ms`
        : `Connection failed to ${device.ipAddress}:${device.port} (unreachable)`;
    }

    await prisma.biometricDevice.update({
      where: { id },
      data: { status: newStatus },
    });

    if (global.io) global.io.emit('device:ping', { id, status: newStatus, latencyMs });

    return reply.send({
      id,
      status: newStatus,
      latencyMs,
      message,
    });
  });

  // ── POST /api/devices/:id/heartbeat ───────────────────────────
  // Lightweight health ping from the physical terminal firmware.
  fastify.post('/:id/heartbeat', { onRequest: [authenticateHardwareDevice] }, async (request, reply) => {
    const { id } = request.params;
    const { firmwareVersion, hardwareModel, batteryLevel, wifiRssi, freeMemory, uptimeSeconds } = request.body || {};

    const updateData = {
      status: 'online',
      lastSeenAt: new Date(),
    };
    if (firmwareVersion) updateData.firmwareVersion = firmwareVersion;
    if (hardwareModel) updateData.hardwareModel = hardwareModel;

    const device = await prisma.biometricDevice.update({
      where: { id },
      data: updateData,
    });

    if (global.io) {
      global.io.emit('device:heartbeat', {
        id,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        batteryLevel,
        wifiRssi,
      });
    }

    return reply.send({
      success: true,
      deviceId: id,
      serverTime: new Date().toISOString(),
      status: device.status,
      telemetry: {
        batteryLevel: batteryLevel ?? null,
        wifiRssi: wifiRssi ?? null,
        freeMemory: freeMemory ?? null,
        uptimeSeconds: uptimeSeconds ?? null,
      }
    });
  });

  // ── POST /api/devices/:id/events ──────────────────────────────
  // Log a raw swipe transaction (Simulator Puncher or physical terminal)
  fastify.post('/:id/events', { onRequest: [authenticateDeviceOrUser] }, async (request, reply) => {
    const { id } = request.params;
    const device = request.hardwareDevice || await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const {
      employeeCode,
      eventType,
      eventTime,
      terminalEventId,
      verificationMode = 'fingerprint',
      confidence,
      batteryLevel,
      wifiRssi,
      firmwareVersion,
      rawData,
      processNow,
    } = request.body || {};

    if (!employeeCode || !eventType) {
      return reply.code(400).send({ error: 'employeeCode and eventType are required' });
    }
    if (!['check_in', 'check_out'].includes(eventType)) {
      return reply.code(400).send({ error: 'eventType must be check_in or check_out' });
    }

    if (terminalEventId) {
      const duplicate = await prisma.deviceSyncLog.findUnique({
        where: { deviceId_terminalEventId: { deviceId: id, terminalEventId } }
      });
      if (duplicate) {
        return reply.send({
          success: true,
          duplicate: true,
          logId: duplicate.id,
          message: 'Event was already received'
        });
      }
    }

    // Lookup user by employeeCode
    const user = await prisma.user.findFirst({
      where: { employeeCode, status: 'active' }
    });

    const eventTimeStr = eventTime || new Date().toISOString();

    const log = await prisma.deviceSyncLog.create({
      data: {
        deviceId: id,
        employeeCode,
        userId: user?.id || null,
        eventType,
        eventTime: eventTimeStr,
        terminalEventId: terminalEventId || null,
        verificationMode,
        rawData: JSON.stringify({
          ...(rawData && typeof rawData === 'object' ? rawData : {}),
          pin: employeeCode,
          verified: 1,
          type: eventType,
          deviceSN: device.serialNumber,
          source: request.deviceAuthSource === 'device' ? 'pico_terminal' : 'device_integration',
          terminalEventId: terminalEventId || null,
          verificationMode,
          confidence: confidence ?? null,
          batteryLevel: batteryLevel ?? null,
          wifiRssi: wifiRssi ?? null,
        }),
        processed: false,
      }
    });

    let processedCount = 0;
    const shouldProcessNow = request.deviceAuthSource === 'device'
      ? processNow !== false
      : parseBoolean(processNow);

    if (shouldProcessNow) {
      processedCount = await processDeviceLogs([log]);
    }

    const deviceUpdate = {
      status: 'online',
      lastSeenAt: new Date(),
    };
    if (firmwareVersion) deviceUpdate.firmwareVersion = firmwareVersion;
    if (processedCount > 0) deviceUpdate.lastSyncAt = new Date();
    await prisma.biometricDevice.update({ where: { id }, data: deviceUpdate });

    if (global.io) {
      global.io.emit('device:eventAdded', {
        deviceId: id,
        logId: log.id,
        employeeCode,
        userName: user?.name || 'Unregistered',
        processedCount
      });
    }

    return reply.code(201).send({
      success: true,
      logId: log.id,
      processedCount,
      message: processedCount > 0
        ? `Swipe event logged and applied for employee ${employeeCode} on device ${device.name}`
        : `Swipe event logged for employee ${employeeCode} on device ${device.name}`
    });
  });

  // ── POST /api/devices/:id/sync ────────────────────────────────
  // Pulls events (either simulated or fetches unprocessed logs) and processes them into AttendanceRecords
  fastify.post('/:id/sync', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const device = await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    if (device.isSimulated) {
      if (device.status === 'offline') {
        return reply.code(422).send({ error: 'Cannot sync: device is offline' });
      }
    } else {
      const res = await pingRealDevice(device.ipAddress, device.port);
      if (res.status === 'offline') {
        return reply.code(422).send({ error: `Cannot sync: real device ${device.ipAddress}:${device.port} is offline` });
      }
    }

    let logsToProcess = [];

    if (device.isSimulated) {
      // Generate mock events for active seeded users
      const users = await prisma.user.findMany({ where: { status: 'active' }, take: 6 });
      const eventTypes = ['check_in', 'check_out'];
      const count = Math.floor(Math.random() * 3) + 2; // 2–4 new events

      for (let i = 0; i < count; i++) {
        const u = users[i % users.length];
        const minutesAgo = Math.floor(Math.random() * 60) + 1;
        const eventType = eventTypes[i % 2];
        const code = u.employeeCode || `EMP${String(users.indexOf(u) + 1).padStart(3, '0')}`;
        const eventTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

        const createdLog = await prisma.deviceSyncLog.create({
          data: {
            deviceId: id,
            employeeCode: code,
            userId: u.id,
            eventType,
            eventTime,
            rawData: JSON.stringify({ pin: code, verified: 1, type: eventType, deviceSN: device.serialNumber }),
            processed: false,
          }
        });
        logsToProcess.push(createdLog);
      }
    } else {
      // Real device: pull unprocessed entries submitted to this device node
      logsToProcess = await prisma.deviceSyncLog.findMany({
        where: { deviceId: id, processed: false }
      });
    }

    let processedCount = 0;

    // Process logs into AttendanceRecord model
    for (const log of logsToProcess) {
      let uId = log.userId;
      
      // If userId is missing, try to resolve it from the employeeCode
      if (!uId && log.employeeCode) {
        const u = await prisma.user.findFirst({ where: { employeeCode: log.employeeCode } });
        if (u) {
          uId = u.id;
          await prisma.deviceSyncLog.update({ where: { id: log.id }, data: { userId: u.id } });
        }
      }

      if (uId) {
        const eventDate = log.eventTime.split('T')[0];
        const dateObj = new Date(log.eventTime);
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        const existingRecord = await prisma.attendanceRecord.findUnique({
          where: { userId_date: { userId: uId, date: eventDate } }
        });

        if (log.eventType === 'check_in') {
          const [h, m] = timeStr.split(':').map(Number);
          const minutesSinceMidnight = h * 60 + m;
          const lateThreshold = 9 * 60 + 15; // 09:15
          const status = minutesSinceMidnight > lateThreshold ? 'late' : 'present';

          if (!existingRecord || !existingRecord.clockIn) {
            await prisma.attendanceRecord.upsert({
              where: { userId_date: { userId: uId, date: eventDate } },
              update: { clockIn: timeStr, status, method: 'biometric' },
              create: {
                userId: uId,
                date: eventDate,
                clockIn: timeStr,
                status,
                method: 'biometric'
              }
            });
          }
        } else if (log.eventType === 'check_out') {
          let clockInTime = existingRecord?.clockIn;
          let hoursWorked = null;
          if (clockInTime) {
            hoursWorked = diffHoursHHMM(clockInTime, timeStr);
          }

          await prisma.attendanceRecord.upsert({
            where: { userId_date: { userId: uId, date: eventDate } },
            update: { clockOut: timeStr, hoursWorked, method: 'biometric' },
            create: {
              userId: uId,
              date: eventDate,
              clockOut: timeStr,
              method: 'biometric',
              hoursWorked
            }
          });
        }

        processedCount++;
      }

      // Mark the sync log as processed
      await prisma.deviceSyncLog.update({
        where: { id: log.id },
        data: { processed: true }
      });
    }

    // Update lastSyncAt for the device
    await prisma.biometricDevice.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });

    if (global.io) {
      global.io.emit('device:synced', {
        id,
        eventCount: logsToProcess.length,
        processedCount
      });
    }

    return reply.send({
      success: true,
      eventCount: logsToProcess.length,
      processedCount,
      message: device.isSimulated
        ? `[SIMULATED] Synced & processed ${processedCount} events from ${device.name}`
        : `[LIVE] Processed ${processedCount} pending hardware transactions from ${device.name}`
    });
  });

  // ── GET /api/devices/:id/logs ─────────────────────────────────
  fastify.get('/:id/logs', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { limit = '50' } = request.query || {};

    const logs = await prisma.deviceSyncLog.findMany({
      where: { deviceId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    // Enrich with user name if userId is set
    const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatar: true } })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    return reply.send(logs.map(l => ({
      ...l,
      userName: l.userId ? userMap[l.userId]?.name || 'Unknown' : 'Unregistered',
      userAvatar: l.userId ? userMap[l.userId]?.avatar || '?' : '?',
    })));
  });

  // ── POST /api/devices/pairing-code ─────────────────────────────
  // Called by Pico to request a new 6-digit pairing code
  fastify.post('/pairing-code', async (request, reply) => {
    let code;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (global.pairingCodes.has(code));

    const deviceIp = request.ip || '127.0.0.1';
    
    global.pairingCodes.set(code, {
      code,
      deviceIp,
      paired: false,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      deviceType: 'pico2w',
    });

    return reply.code(201).send({ code });
  });

  // ── GET /api/devices/pair/status ──────────────────────────────
  // Polled by Pico to check if pairing is complete
  fastify.get('/pair/status', async (request, reply) => {
    const { code } = request.query || {};
    if (!code) {
      return reply.code(400).send({ error: 'Pairing code is required' });
    }

    const pairing = global.pairingCodes.get(code);
    if (!pairing) {
      return reply.code(404).send({ error: 'Pairing code not found or expired' });
    }

    if (Date.now() > pairing.expiresAt) {
      global.pairingCodes.delete(code);
      return reply.code(400).send({ expired: true, error: 'Pairing code expired' });
    }

    if (pairing.paired) {
      const response = {
        paired: true,
        deviceId: pairing.deviceId,
        deviceKey: pairing.deviceKey,
      };
      global.pairingCodes.delete(code);
      return reply.send(response);
    }

    return reply.send({ paired: false });
  });

  // ── POST /api/devices/pair ─────────────────────────────────────
  // Called by Web UI to pair a device via its pairing code
  fastify.post('/pair', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Only Super Admin or Admin can pair devices' });
    }

    const { code, name, location, notes } = request.body || {};
    if (!code || !name) {
      return reply.code(400).send({ error: 'code and name are required' });
    }

    const pairing = global.pairingCodes.get(code);
    if (!pairing) {
      return reply.code(404).send({ error: 'Pairing code not found or expired' });
    }

    if (Date.now() > pairing.expiresAt) {
      global.pairingCodes.delete(code);
      return reply.code(400).send({ error: 'Pairing code has expired' });
    }

    const apiKey = generateDeviceApiKey();
    const apiKeyLast4 = apiKey.slice(-4);

    const device = await prisma.biometricDevice.create({
      data: {
        name,
        ipAddress: pairing.deviceIp,
        port: 4370,
        deviceType: pairing.deviceType || 'pico2w',
        location: location || '',
        notes: notes || '',
        status: 'online',
        lastSeenAt: new Date(),
        apiKeyHash: hashDeviceApiKey(apiKey),
        apiKeyLast4,
        apiKeyCreatedAt: new Date(),
        isSimulated: false,
        isActive: true,
      }
    });

    // Automatically set the serialNumber to the device ID so it matches attendance queries
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { serialNumber: device.id }
    });

    pairing.paired = true;
    pairing.deviceId = device.id;
    pairing.deviceKey = apiKey;
    global.pairingCodes.set(code, pairing);

    if (global.io) global.io.emit('device:added', { id: device.id, name: device.name });

    return reply.send({ success: true, deviceId: device.id, name: device.name });
  });
}

module.exports = devicesRoutes;
