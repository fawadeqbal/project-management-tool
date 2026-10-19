import { describe, expect, it, beforeEach } from 'vitest';
import { ConflictError, FixedClock, Sprint, parseDateOnly, type Actor } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { FakePublisher, InMemorySnapshotStore, InMemorySprintRepository, InMemorySprintTaskStore, task } from '../testing/in-memory';
import { StartSprintHandler } from './start-sprint.handler';
import { StartSprintCommand } from './start-sprint.command';
import { CompleteSprintHandler } from './complete-sprint.handler';
import { CompleteSprintCommand } from './complete-sprint.command';
import { AddSprintTaskHandler } from './add-sprint-task.handler';
import { AddSprintTaskCommand } from './add-sprint-task.command';
import { RankBacklogHandler } from './rank-backlog.handler';
import { RankBacklogCommand } from './rank-backlog.command';

const actor: Actor = { userId: 'u1', workspaceId: 'w1', role: 'MEMBER' };
const clock = new FixedClock(new Date('2026-10-19T10:00:00Z'));
const plan = (id: string, number: number, start: string, end: string) =>
  Sprint.plan({ id, projectId: 'p1', workspaceId: 'w1', number, startDate: parseDateOnly(start), endDate: parseDateOnly(end) }, 'u1', clock.now());

describe('sprint lifecycle handlers', () => {
  let repo: InMemorySprintRepository;
  let tasks: InMemorySprintTaskStore;
  let snaps: InMemorySnapshotStore;
  let events: FakePublisher;
  const access = new AccessService();
  const pub = () => events as unknown as DomainEventPublisher;

  beforeEach(() => {
    const s24 = plan('s24', 24, '2026-10-13', '2026-10-26');
    const s25 = plan('s25', 25, '2026-10-27', '2026-11-09');
    s24.pullEvents();
    s25.pullEvents();
    repo = new InMemorySprintRepository([s24, s25]);
    tasks = new InMemorySprintTaskStore([
      task('301', { sprintId: 's24', status: 'DONE', points: 5 }),
      task('306', { sprintId: 's24', status: 'IN_PROGRESS', priority: 'URGENT', points: 8 }),
      task('311', { sprintId: 's24', points: 8 }),
      task('320', { backlogRank: 1, points: 8 }),
      task('322', { backlogRank: 2, points: 5 }),
    ]);
    snaps = new InMemorySnapshotStore(repo);
    events = new FakePublisher();
  });

  it('starts a sprint committing to its points and records day one of the burndown', async () => {
    const start = new StartSprintHandler(repo, tasks, snaps, access, pub(), clock);
    const dto = await start.execute(new StartSprintCommand(actor, 's24'));
    expect(dto).toMatchObject({ status: 'ACTIVE', committedPoints: 21, scopePoints: 21, completedPoints: 5 });
    expect(snaps.rows.get('s24:2026-10-19')).toEqual({ remainingPoints: 16, scopePoints: 21 });
    expect(events.events.map((e) => e.type)).toEqual(['sprint.started']);
  });

  it('refuses a second active sprint in the project (409)', async () => {
    const start = new StartSprintHandler(repo, tasks, snaps, access, pub(), clock);
    await start.execute(new StartSprintCommand(actor, 's24'));
    await expect(start.execute(new StartSprintCommand(actor, 's25'))).rejects.toBeInstanceOf(ConflictError);
  });

  it('completes into the backlog: unfinished work goes to the top, pre-sorted', async () => {
    await new StartSprintHandler(repo, tasks, snaps, access, pub(), clock).execute(new StartSprintCommand(actor, 's24'));
    const retro = await new CompleteSprintHandler(repo, tasks, snaps, access, pub(), clock).execute(new CompleteSprintCommand(actor, 's24', 'backlog'));
    expect(retro.sprint.status).toBe('COMPLETED');
    expect(retro.unfinished.map((t) => t.id)).toEqual(['306', '311']);
    expect(retro).toMatchObject({ completedPoints: 5, unfinishedPoints: 16, completionPct: 24, movedTo: { kind: 'backlog', sprint: null } });
    const backlog = tasks.tasks.filter((t) => !t.sprintId && t.status !== 'DONE').sort((a, b) => a.backlogRank! - b.backlogRank!);
    expect(backlog.map((t) => t.id)).toEqual(['306', '311', '320', '322']);
  });

  it('completes into the next sprint, planning one if none is planned', async () => {
    repo.rows.delete('s25');
    await new StartSprintHandler(repo, tasks, snaps, access, pub(), clock).execute(new StartSprintCommand(actor, 's24'));
    const retro = await new CompleteSprintHandler(repo, tasks, snaps, access, pub(), clock).execute(new CompleteSprintCommand(actor, 's24', 'next'));
    expect(retro.movedTo.sprint).toMatchObject({ number: 25, status: 'PLANNED', startDate: '2026-10-27', taskCount: 2 });
    expect(events.events.map((e) => e.type)).toContain('sprint.planned');
  });

  it('records a scope change when work is added after the start', async () => {
    await new StartSprintHandler(repo, tasks, snaps, access, pub(), clock).execute(new StartSprintCommand(actor, 's24'));
    const dto = await new AddSprintTaskHandler(repo, tasks, access, pub(), clock).execute(new AddSprintTaskCommand(actor, 's24', '320'));
    expect(dto.scopePoints).toBe(29);
    const added = events.events.find((e) => e.type === 'sprint.task_added')!;
    expect(added.payload).toMatchObject({ taskId: '320', points: 8, afterStart: true });
  });

  it('ranks a backlog task between two others with one write', async () => {
    const res = await new RankBacklogHandler(tasks, access, pub(), clock).execute(new RankBacklogCommand(actor, 'p1', { taskId: '322', afterId: '320' }));
    expect(res.backlogRank).toBeLessThan(1);
  });
});
