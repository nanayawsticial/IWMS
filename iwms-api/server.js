// Fix: Supabase direct DB is IPv6-only on this network. Allow Node.js to use AAAA records.
require('dns').setDefaultResultOrder('verbatim');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is missing!');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_REFRESH_SECRET environment variable is missing!');
  process.exit(1);
}

const Fastify = require('fastify');
const cors    = require('@fastify/cors');
const jwt     = require('@fastify/jwt');
const http    = require('http');
const { Server: SocketIO } = require('socket.io');
const { startCronJobs } = require('./lib/cron');
const { initMailer }    = require('./lib/mailer');
const { getSecret }     = require('./lib/runtime');

// Global in-memory map for device pairing codes
global.pairingCodes = new Map();

// ── Fastify app ────────────────────────────────────────────────
const app = Fastify({ logger: { level: 'warn' } });
const allowedCorsMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl, or local scripts)
    if (!origin) {
      cb(null, true);
      return;
    }
    // Allow local development addresses and any Vercel deployments
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://192.168') ||
      origin.endsWith('.vercel.app')
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'), false);
  },
  methods: allowedCorsMethods,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Key'],
  credentials: true,
});

app.register(jwt, {
  secret: getSecret('JWT_SECRET', 'fallback-secret'),
});

app.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: (request, context) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please try again in ${context.after}.`
    };
  }
});

// ── Auth decorator ─────────────────────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
});

// ── Routes ─────────────────────────────────────────────────────
app.register(require('./routes/auth'),        { prefix: '/api/auth' });
app.register(require('./routes/mfa'),         { prefix: '/api/auth/mfa' });
app.register(require('./routes/users'),       { prefix: '/api/users' });
app.register(require('./routes/departments'), { prefix: '/api/departments' });
app.register(require('./routes/tasks'),       { prefix: '/api/tasks' });
app.register(require('./routes/attendance'),  { prefix: '/api/attendance' });
app.register(require('./routes/leaves'),      { prefix: '/api/leaves' });
app.register(require('./routes/shifts'),      { prefix: '/api/shifts' });
app.register(require('./routes/notifications'),{ prefix: '/api/notifications' });
app.register(require('./routes/devices'),     { prefix: '/api/devices' });
app.register(require('./routes/geofence'),    { prefix: '/api/geofence' });
app.register(require('./routes/reports'),     { prefix: '/api/reports' });

app.get('/api/health', async () => ({
  status: 'ok', timestamp: new Date().toISOString(), service: 'IWMS API', version: '2.0.0',
}));

// ── Boot ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  await app.ready();

  const io = new SocketIO(app.server, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1') ||
          origin.startsWith('http://192.168') ||
          origin.endsWith('.vercel.app')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = app.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userName = socket.data.user?.email || 'guest';
    console.log(`🔌 Socket connected: ${userName} (${socket.id})`);

    // Join user to their own room for private events
    if (socket.data.user?.sub) {
      socket.join(`user:${socket.data.user.sub}`);
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${userName}`);
    });

    // Broadcast dragging status to other clients
    socket.on('task:dragStart', (data) => {
      socket.broadcast.emit('task:dragged', {
        ...data,
        userName: socket.data.user?.name || userName.split('@')[0],
        isDragging: true,
      });
    });

    socket.on('task:dragEnd', (data) => {
      socket.broadcast.emit('task:dragged', {
        ...data,
        userName: socket.data.user?.name || userName.split('@')[0],
        isDragging: false,
      });
    });

    // Client can request fresh stats immediately on connect
    socket.on('stats:request', async () => {
      try {
        const { getAttendanceStats } = require('./lib/cron');
        const today = new Date().toISOString().split('T')[0];
        const stats = await getAttendanceStats(today);
        socket.emit('stats:update', { stats, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('❌ Failed to fetch stats for socket client:', err.message);
      }
    });
  });

  // Expose io instance globally so route handlers can emit events
  global.io = io;

  // Start scheduled jobs
  startCronJobs(io);

  // Initialise mailer (generates Ethereal test account)
  initMailer().catch(() => {});

  // Start HTTP server using Fastify's native listen
  await app.listen({ port: PORT, host: '0.0.0.0' });

  console.log('');
  console.log('🚀 IWMS API v2.0 running');
  console.log(`   REST:      http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log('');
  console.log('📋 REST Endpoints:');
  console.log('   POST   /api/auth/login');
  console.log('   GET    /api/users');
  console.log('   GET    /api/tasks');
  console.log('   GET    /api/attendance');
  console.log('   POST   /api/attendance/clock-in    ← emits attendance:clockIn');
  console.log('   POST   /api/attendance/clock-out   ← emits attendance:clockOut');
  console.log('   PATCH  /api/tasks/:id              ← emits task:updated');
  console.log('   POST   /api/notifications/test     ← sends test email');
  console.log('');
  console.log('📡 Socket.io Events:');
  console.log('   → attendance:clockIn    → attendance:clockOut');
  console.log('   → task:updated          → stats:update (every 60s)');
  console.log('   → attendance:lateAlert  → report:generated');
  console.log('');
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
