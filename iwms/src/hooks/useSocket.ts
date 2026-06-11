'use client';

import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket, SocketEvent } from '@/lib/socket';
import { getAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Connect on mount / disconnect on unmount.
 * Returns a stable `on(event, handler)` function for subscribing to events.
 */
export function useSocket() {
  const { user } = useAuth();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (token) {
      connectSocket(token);
      connectedRef.current = true;
    }
    return () => {
      // Don't disconnect here — socket is shared across components.
      // AppLayout handles the lifecycle.
    };
  }, [user]);

  const on = useCallback((event: SocketEvent, handler: (...args: any[]) => void) => {
    const s = getSocket();
    s.on(event, handler);
    return () => { s.off(event, handler); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const s = getSocket();
    if (s.connected) s.emit(event, data);
  }, []);

  return { on, emit };
}

/**
 * Subscribe to a specific socket event. Auto-unsubscribes on unmount.
 */
export function useSocketEvent<T = unknown>(event: SocketEvent, handler: (data: T) => void) {
  const { on } = useSocket();
  useEffect(() => {
    const off = on(event, handler);
    return off;
  }, [event, handler, on]);
}
