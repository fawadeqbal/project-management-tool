import type { QueryClient } from '@tanstack/react-query';
import type { RealtimeEventDto } from '@hearth/contracts';
import { queryKeys } from '@/shared/api/query-keys';

/** Task id for an event: the aggregate for task.*, payload.taskId for comment.* and others. */
const taskIdOf = (e: RealtimeEventDto): string | null => {
  const fromPayload = e.payload.taskId;
  if (typeof fromPayload === 'string') return fromPayload;
  return e.type.startsWith('task.') ? e.aggregateId : null;
};

/**
 * Maps a domain event to the cached queries it makes stale (Observer → cache reconciliation).
 * Kept pure so it is trivially testable: returns the keys, the caller invalidates them.
 */
export const keysForEvent = (e: RealtimeEventDto): (readonly unknown[])[] => {
  const keys: (readonly unknown[])[] = [];
  const taskId = taskIdOf(e);
  if (e.type.startsWith('task.')) {
    keys.push(queryKeys.tasks.all, queryKeys.shell);
    if (taskId) keys.push(queryKeys.task(taskId));
    keys.push(['task', 'key']);
  } else if (e.type.startsWith('comment.')) {
    if (taskId) keys.push(queryKeys.task(taskId));
    keys.push(['task', 'key'], queryKeys.tasks.all);
  } else if (e.type.startsWith('notification.')) {
    keys.push(queryKeys.shell, queryKeys.inbox);
  } else {
    keys.push(queryKeys.shell);
  }
  return keys;
};

export const applyRealtimeEvent = (client: QueryClient, e: RealtimeEventDto): void => {
  for (const queryKey of keysForEvent(e)) void client.invalidateQueries({ queryKey });
};
