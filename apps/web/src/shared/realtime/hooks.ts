import { useEffect, useRef, useState } from 'react';
import type { RealtimeEventDto, UserRefDto } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useRealtimeBus } from './RealtimeProvider';

/**
 * Runs `handler` for every domain event whose type starts with `typePrefix`
 * ("task." , "sprint.", "notification.created"). Cache invalidation already happens globally;
 * use this for extra reactions (a toast, a highlight).
 */
export function useRealtimeEvent(typePrefix: string, handler: (event: RealtimeEventDto) => void) {
  const bus = useRealtimeBus();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(
    () =>
      bus.subscribe((e) => {
        if (e.type.startsWith(typePrefix)) ref.current(e);
      }),
    [bus, typePrefix],
  );
}

/** Announces that I'm viewing `taskId` and returns the other people viewing it. */
export function usePresence(taskId: string | null | undefined): UserRefDto[] {
  const bus = useRealtimeBus();
  const myId = useAuthStore((s) => s.me?.user.id);
  const [viewers, setViewers] = useState<UserRefDto[]>([]);

  useEffect(() => {
    if (!taskId) return;
    const off = bus.onPresence((p) => {
      if (p.taskId === taskId) setViewers(p.viewers.filter((v) => v.id !== myId));
    });
    bus.emitPresence(taskId);
    return () => {
      off();
      bus.emitPresence(null);
      setViewers([]);
    };
  }, [bus, taskId, myId, bus.connected]);

  return viewers;
}
