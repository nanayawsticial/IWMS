const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { parseBoolean } = require('../lib/runtime');

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

async function geofenceRoutes(fastify) {
  // ── GET /api/geofence ─────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const zones = await prisma.geoFenceZone.findMany({ orderBy: { createdAt: 'asc' } });
    return reply.send(zones);
  });

  // ── POST /api/geofence ────────────────────────────────────────
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Only Super Admin or Admin can add zones' });
    }

    const { name, latitude, longitude, radiusMeters, notes } = request.body || {};
    if (!name || latitude === undefined || longitude === undefined) {
      return reply.code(400).send({ error: 'name, latitude, and longitude are required' });
    }

    const zone = await prisma.geoFenceZone.create({
      data: {
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: radiusMeters ? parseInt(radiusMeters) : 200,
        notes: notes || '',
      },
    });

    return reply.code(201).send(zone);
  });

  // ── PATCH /api/geofence/:id ───────────────────────────────────
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    const { id } = request.params;
    const { name, latitude, longitude, radiusMeters, isActive, notes } = request.body || {};

    const updateData = {};
    if (name !== undefined)         updateData.name = name;
    if (latitude !== undefined)     updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined)    updateData.longitude = parseFloat(longitude);
    if (radiusMeters !== undefined) updateData.radiusMeters = parseInt(radiusMeters);
    if (isActive !== undefined)     updateData.isActive = parseBoolean(isActive);
    if (notes !== undefined)        updateData.notes = notes;

    const updated = await prisma.geoFenceZone.update({ where: { id }, data: updateData });
    return reply.send(updated);
  });

  // ── DELETE /api/geofence/:id ──────────────────────────────────
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.user;
    if (!['super_admin', 'admin'].includes(role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
    await prisma.geoFenceZone.delete({ where: { id: request.params.id } });
    return reply.send({ success: true });
  });

  // ── POST /api/geofence/validate ───────────────────────────────
  // Called by web clock-in to validate employee GPS location against active zones
  fastify.post('/validate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { latitude, longitude } = request.body || {};
    if (latitude === undefined || longitude === undefined) {
      return reply.code(400).send({ error: 'latitude and longitude are required' });
    }

    const zones = await prisma.geoFenceZone.findMany({ where: { isActive: true } });

    if (zones.length === 0) {
      // No zones configured — allow all
      return reply.send({ allowed: true, message: 'No geo-fence zones configured', matchedZone: null });
    }

    let closestZone = null;
    let closestDistance = Infinity;

    for (const zone of zones) {
      const dist = haversineDistance(latitude, longitude, zone.latitude, zone.longitude);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestZone = zone;
      }
      if (dist <= zone.radiusMeters) {
        return reply.send({
          allowed: true,
          matchedZone: zone.name,
          distanceMeters: Math.round(dist),
          message: `Location verified within ${zone.name}`,
        });
      }
    }

    return reply.send({
      allowed: false,
      matchedZone: null,
      closestZone: closestZone?.name,
      distanceMeters: Math.round(closestDistance),
      message: `You are ${Math.round(closestDistance)}m away from the nearest allowed zone (${closestZone?.name}). Clock-in may be flagged.`,
    });
  });
}

module.exports = geofenceRoutes;
