import { AccessPolicy, FixedClock, parseDateOnly, toDateOnly, type Actor, type DomainEvent } from '@hearth/domain';
import type { AccessService } from '../../../../shared/access/access.service';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { ProjectSchedule, ScheduleItem, ScheduleReader, ScheduleUpdate, ScheduleWriter } from '../schedule.ports';
import { RescheduleTaskCommand, RescheduleTaskHandler } from './reschedule-task.handler';
import { ApplyScheduleCommand, ApplyScheduleHandler } from './apply-schedule.handler';

const item = (id: string, label: string, s: string, e: string, kind: 'task' | 'milestone' = 'task'): ScheduleItem => ({
  id,
  label,
  kind,
  projectId: 'web',
  start: parseDateOnly(s),
  end: parseDateOnly(e),
  startDate: parseDateOnly(s),
  dueDate: parseDateOnly(e),
});

/** In-memory schedule: the Website relaunch chain pricing → nav → QA → Launch, plus copy. */
class InMemorySchedule implements ScheduleReader, ScheduleWriter {
  items = new Map<string, ScheduleItem>([
    ['pricing', item('pricing', 'HRT-188', '2026-10-23', '2026-10-30')],
    ['nav', item('nav', 'HRT-192', '2026-10-31', '2026-11-07')],
    ['qa', item('qa', 'HRT-209', '2026-11-08', '2026-11-13')],
    ['launch', item('launch', 'Launch', '2026-11-14', '2026-11-14', 'milestone')],
    ['copy', item('copy', 'HRT-204', '2026-10-21', '2026-10-30')],
  ]);
  edges = [
    { blockerId: 'pricing', blockedId: 'nav' },
    { blockerId: 'nav', blockedId: 'qa' },
    { blockerId: 'qa', blockedId: 'launch' },
  ];
  applied: ScheduleUpdate[][] = [];

  async scheduleForTask(_w: string, taskId: string) {
    const task = this.items.get(taskId);
    if (!task) return null;
    const schedule: ProjectSchedule = { projectId: 'web', items: [...this.items.values()].map((i) => ({ ...i })), edges: this.edges };
    return { task: { ...task }, schedule };
  }
  async itemsByIds(_w: string, refs: { id: string }[]) {
    return refs.map((r) => this.items.get(r.id)).filter((x): x is ScheduleItem => !!x).map((i) => ({ ...i }));
  }
  async apply(updates: ScheduleUpdate[]) {
    this.applied.push(updates);
    for (const u of updates) {
      const cur = this.items.get(u.id)!;
      this.items.set(u.id, { ...cur, startDate: u.startDate, dueDate: u.dueDate, start: u.startDate ?? cur.start, end: u.dueDate ?? cur.end });
    }
  }
}

const policy = new AccessPolicy();
const access = { allows: policy.allows.bind(policy), assert: policy.assert.bind(policy) } as unknown as AccessService;
const sara: Actor = { userId: 'sara', workspaceId: 'w1', role: 'ADMIN' };
const viewer: Actor = { userId: 'vic', workspaceId: 'w1', role: 'VIEWER' };

function setup() {
  const store = new InMemorySchedule();
  const events: DomainEvent[] = [];
  const publisher = { publish: (...e: DomainEvent[]) => events.push(...e) } as unknown as DomainEventPublisher;
  const clock = new FixedClock(new Date('2026-10-19T09:00:00Z'));
  return {
    store,
    events,
    reschedule: new RescheduleTaskHandler(store, store, clock, access, publisher),
    apply: new ApplyScheduleHandler(store, store, clock, access, publisher),
  };
}

const dates = (store: InMemorySchedule, id: string) => {
  const i = store.items.get(id)!;
  return [toDateOnly(i.startDate!), toDateOnly(i.dueDate!)];
};

describe('RescheduleTaskHandler', () => {
  it('moves the task, shifts dependents and gated milestones in one write, and publishes task.rescheduled', async () => {
    const { store, events, reschedule } = setup();
    const res = await reschedule.execute(new RescheduleTaskCommand(sara, 'pricing', { startDate: '2026-10-25', dueDate: '2026-11-01', shiftDependents: true }));
    expect(res.task).toMatchObject({ label: 'HRT-188', days: 2 });
    expect(res.shifted).toEqual([
      { taskId: 'nav', key: 'HRT-192', days: 2, kind: 'task' },
      { taskId: 'qa', key: 'HRT-209', days: 2, kind: 'task' },
      { taskId: 'launch', key: 'Launch', days: 2, kind: 'milestone' },
    ]);
    expect(store.applied).toHaveLength(1);
    expect(dates(store, 'nav')).toEqual(['2026-11-02', '2026-11-09']);
    expect(dates(store, 'copy')).toEqual(['2026-10-21', '2026-10-30']);
    const rescheduled = events.filter((e) => e.type === 'task.rescheduled');
    expect(rescheduled.map((e) => e.aggregateId)).toEqual(['pricing', 'nav', 'qa']);
    expect(rescheduled[0]!.payload).toEqual({ key: 'HRT-188', startDate: '2026-10-25', dueDate: '2026-11-01', projectId: 'web' });
    expect(events.map((e) => e.type)).toContain('milestone.rescheduled');
    expect(res.previous[0]).toEqual({ kind: 'task', id: 'pricing', startDate: '2026-10-23', dueDate: '2026-10-30' });
  });

  it('keeps dependents in place when shifting is off', async () => {
    const { store, reschedule } = setup();
    const res = await reschedule.execute(new RescheduleTaskCommand(sara, 'pricing', { startDate: '2026-10-28', dueDate: '2026-11-04', shiftDependents: false }));
    expect(res.shifted).toEqual([]);
    expect(dates(store, 'nav')).toEqual(['2026-10-31', '2026-11-07']);
  });

  it('undo restores every previous date via ApplySchedule', async () => {
    const { store, reschedule, apply } = setup();
    const res = await reschedule.execute(new RescheduleTaskCommand(sara, 'pricing', { startDate: '2026-10-25', dueDate: '2026-11-01', shiftDependents: true }));
    await apply.execute(new ApplyScheduleCommand(sara, { items: res.previous }));
    expect(dates(store, 'pricing')).toEqual(['2026-10-23', '2026-10-30']);
    expect(dates(store, 'qa')).toEqual(['2026-11-08', '2026-11-13']);
    expect(dates(store, 'launch')).toEqual(['2026-11-14', '2026-11-14']);
  });

  it('refuses viewers and unknown tasks', async () => {
    const { reschedule } = setup();
    await expect(reschedule.execute(new RescheduleTaskCommand(viewer, 'pricing', { startDate: '2026-10-25', dueDate: '2026-11-01', shiftDependents: true }))).rejects.toMatchObject({
      kind: 'forbidden',
    });
    await expect(reschedule.execute(new RescheduleTaskCommand(sara, 'ghost', { startDate: '2026-10-25', dueDate: '2026-11-01', shiftDependents: true }))).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});
