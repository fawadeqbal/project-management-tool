import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { WS_EVENT, WS_PRESENCE, type RealtimeEventDto, type UserRefDto } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { applyRealtimeEvent } from './event-router';

type EventHandler = (event: RealtimeEventDto) => void;

export interface PresencePayload {
  taskId: string | null;
  viewers: UserRefDto[];
}

/** The pieces features need; the socket itself stays private (Adapter). */
interface RealtimeBus {
  connected: boolean;
  subscribe: (handler: EventHandler) => () => void;
  emitPresence: (taskId: string | null) => void;
  onPresence: (handler: (p: PresencePayload) => void) => () => void;
}

const noopBus: RealtimeBus = {
  connected: false,
  subscribe: () => () => undefined,
  emitPresence: () => undefined,
  onPresence: () => () => undefined,
};

const RealtimeContext = createContext<RealtimeBus>(noopBus);

const isPresencePayload = (v: unknown): v is PresencePayload =>
  typeof v === 'object' && v !== null && Array.isArray((v as { viewers?: unknown }).viewers);

/**
 * Opens one socket per signed-in workspace and turns domain events into query invalidations.
 * Without a token (or in tests) it renders children with a no-op bus.
 */
export function RealtimeProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const client = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const handlers = useRef(new Set<EventHandler>());
  const presenceHandlers = useRef(new Set<(p: PresencePayload) => void>());
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !token || !workspaceId) return;
    const socket = io({
      path: '/socket.io',
      auth: { token },
      query: { workspaceId },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(WS_EVENT, (event: RealtimeEventDto) => {
      applyRealtimeEvent(client, event);
      handlers.current.forEach((h) => h(event));
    });
    socket.on(WS_PRESENCE, (payload: unknown) => {
      if (isPresencePayload(payload)) presenceHandlers.current.forEach((h) => h(payload));
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, token, workspaceId, client]);

  const bus = useMemo<RealtimeBus>(
    () => ({
      connected,
      subscribe: (h) => {
        handlers.current.add(h);
        return () => void handlers.current.delete(h);
      },
      emitPresence: (taskId) => socketRef.current?.emit(WS_PRESENCE, { taskId }),
      onPresence: (h) => {
        presenceHandlers.current.add(h);
        return () => void presenceHandlers.current.delete(h);
      },
    }),
    [connected],
  );

  return <RealtimeContext.Provider value={bus}>{children}</RealtimeContext.Provider>;
}

export const useRealtimeBus = () => useContext(RealtimeContext);
