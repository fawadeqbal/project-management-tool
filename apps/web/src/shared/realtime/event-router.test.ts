import { describe, expect, it } from 'vitest';
import type { RealtimeEventDto } from '@hearth/contracts';
import { keysForEvent } from './event-router';

const event = (type: string, payload: Record<string, unknown> = {}): RealtimeEventDto => ({
  type,
  aggregateId: 'agg-1',
  actorId: 'u1',
  workspaceId: 'w1',
  occurredAt: '2026-10-19T10:00:00.000Z',
  payload,
});

describe('keysForEvent', () => {
  it('task.* invalidates task lists and that task', () => {
    const keys = keysForEvent(event('task.status_changed'));
    expect(keys).toContainEqual(['tasks']);
    expect(keys).toContainEqual(['task', 'agg-1']);
  });

  it('comment.* invalidates the task it belongs to', () => {
    expect(keysForEvent(event('comment.added', { taskId: 't9' }))).toContainEqual(['task', 't9']);
  });

  it('notification.* invalidates shell and inbox', () => {
    const keys = keysForEvent(event('notification.created'));
    expect(keys).toContainEqual(['shell']);
    expect(keys).toContainEqual(['inbox']);
  });

  it('anything else refreshes the shell', () => {
    expect(keysForEvent(event('project.renamed'))).toEqual([['shell']]);
  });
});
