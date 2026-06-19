import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: getAccessToken() },
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket?.id);
      socket?.emit('stats:request');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('🔌 Socket error:', err.message);
    });
  }
  return socket;
}

export function connectSocket(token?: string) {
  const s = getSocket();
  if (token) s.auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}

export type SocketEvent =
  | 'attendance:clockIn'
  | 'attendance:clockOut'
  | 'attendance:late'
  | 'attendance:lateAlert'
  | 'task:updated'
  | 'task:reviewRequested'
  | 'task:approved'
  | 'task:commentAdded'
  | 'task:dragged'
  | 'task:dragStart'
  | 'task:dragEnd'
  | 'stats:update'
  | 'report:generated'
  | 'device:added'
  | 'device:removed'
  | 'device:ping'
  | 'device:synced'
  | 'device:heartbeat'
  | 'notification:new'
  | 'leave:created'
  | 'leave:updated'
  | 'attendance:updated';

