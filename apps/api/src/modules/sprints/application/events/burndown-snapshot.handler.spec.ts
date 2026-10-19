import { describe, expect, it } from 'vitest';
import { FixedClock, Sprint, createEvent, parseDateOnly } from '@hearth/domain';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import {
  InMemorySnapshotStore,
  InMemorySprintRepository,
  InMemorySprintTaskStore,
  task,
} from '../testing/in-memory';
import { BurndownSnapshotHandler } from './burndown-snapshot.handler';

const clock = new FixedClock(new Date('2026-10-21T15:00:00Z'));
const base = (aggregateId: string) => ({
  workspaceId: 'w1',
  actorId: 'u1',
  aggregateId,
  occurredAt: clock.now(),
});

const setup = () => {
  const sprint = Sprint.plan(
    {
      id: 's24',
      projectId: 'p1',
      workspaceId: 'w1',
      number: 24,
      startDate: parseDateOnly('2026-10-13'),
      endDate: parseDateOnly('2026-10-26'),
    },
    'u1',
    clock.now(),
  );
  sprint.start(13, false, 'u1', clock.now());
  const repo = new InMemorySprintRepository([sprint]);
  const tasks = new InMemorySprintTaskStore([
    task('a', { sprintId: 's24', status: 'DONE', points: 5 }),
    task('b', { sprintId: 's24', points: 8 }),
    task('c', { points: 2 }),
  ]);
  const snaps = new InMemorySnapshotStore(repo);
  return { tasks, snaps, handler: new BurndownSnapshotHandler(tasks, snaps, clock) };
};

describe('BurndownSnapshotHandler', () => {
  it('upserts today’s snapshot when a sprint task changes status', async () => {
    const { tasks, snaps, handler } = setup();
    tasks.tasks[1]!.status = 'DONE';
    await handler.handle(
      new DomainEventEnvelope(
        createEvent('task.status_changed', base('b'), {
          key: 'HRT-b',
          title: 'b',
          from: 'TODO',
          to: 'DONE',
          projectId: 'p1',
        }),
      ),
    );
    expect(snaps.rows.get('s24:2026-10-21')).toEqual({ remainingPoints: 0, scopePoints: 13 });
  });

  it('refreshes the active sprint when a task leaves it', async () => {
    const { tasks, snaps, handler } = setup();
    tasks.tasks[1]!.sprintId = null;
    await handler.handle(
      new DomainEventEnvelope(
        createEvent('task.updated', base('b'), { key: 'HRT-b', fields: ['sprintId'], projectId: 'p1' }),
      ),
    );
    expect(snaps.rows.get('s24:2026-10-21')).toEqual({ remainingPoints: 0, scopePoints: 5 });
  });

  it('reacts to sprint scope changes and ignores unrelated events', async () => {
    const { tasks, snaps, handler } = setup();
    tasks.tasks[2]!.sprintId = 's24';
    await handler.handle(
      new DomainEventEnvelope(
        createEvent('task.renamed', base('c'), { key: 'HRT-c', from: 'x', to: 'y', projectId: 'p1' }),
      ),
    );
    expect(snaps.rows.size).toBe(0);
    await handler.handle(
      new DomainEventEnvelope(
        createEvent('sprint.task_added', base('s24'), { taskId: 'c', points: 2, afterStart: true }),
      ),
    );
    expect(snaps.rows.get('s24:2026-10-21')).toEqual({ remainingPoints: 10, scopePoints: 15 });
  });
});
