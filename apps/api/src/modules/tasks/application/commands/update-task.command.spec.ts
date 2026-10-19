import { ForbiddenError, Task } from '@hearth/domain';
import { actorOf, createKit, TODAY, WS, type TaskTestKit } from '../../testing/task-test-kit';
import { UpdateTaskCommand, UpdateTaskHandler } from './update-task.command';

const seedTask = async (
  kit: TaskTestKit,
  id: string,
  number: number,
  extra: Partial<Parameters<typeof Task.create>[0]> = {},
) => {
  const t = Task.create(
    {
      id,
      workspaceId: WS,
      keyPrefix: 'HRT',
      number,
      creatorId: 'u-fawad',
      title: `Task ${number}`,
      projectId: 'p-web',
      ...extra,
    },
    TODAY,
  );
  t.pullEvents();
  await kit.tasks.save(t);
  return t;
};

describe('UpdateTaskHandler', () => {
  let kit: TaskTestKit;
  let handler: UpdateTaskHandler;

  beforeEach(() => {
    kit = createKit();
    kit.clock.set(new Date('2026-10-19T15:30:00Z'));
    handler = new UpdateTaskHandler(
      kit.tasks,
      kit.directory,
      kit.relations,
      kit.clock,
      kit.access,
      kit.publisher.asPublisher(),
      kit.read,
    );
  });

  it('emits status_changed and sets completedAt when done', async () => {
    await seedTask(kit, 't-1', 10);
    await handler.execute(new UpdateTaskCommand(actorOf(), 't-1', { status: 'DONE' }));
    const saved = (await kit.tasks.findById(WS, 't-1'))!.toSnapshot();
    expect(saved.status).toBe('DONE');
    expect(saved.completedAt?.toISOString()).toBe('2026-10-19T15:30:00.000Z');
    expect(saved.progress).toBe(100);
    expect(kit.publisher.events.map((e) => [e.type, e.payload])).toEqual([
      [
        'task.status_changed',
        { key: 'HRT-10', title: 'Task 10', from: 'TODO', to: 'DONE', projectId: 'p-web' },
      ],
    ]);
  });

  it('merges a single date with the existing schedule in one reschedule', async () => {
    await seedTask(kit, 't-1', 10, { startDate: new Date('2026-10-20'), dueDate: new Date('2026-10-24') });
    await handler.execute(new UpdateTaskCommand(actorOf(), 't-1', { dueDate: '2026-10-26' }));
    const saved = (await kit.tasks.findById(WS, 't-1'))!.toSnapshot();
    expect(saved.startDate?.toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(saved.dueDate?.toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(kit.publisher.types()).toEqual(['task.rescheduled']);
  });

  it('auto-follows a new assignee and replaces tags', async () => {
    await seedTask(kit, 't-1', 10);
    await handler.execute(
      new UpdateTaskCommand(actorOf(), 't-1', { assigneeId: 'u-mo', tagIds: ['tag-a'], epic: 'Launch' }),
    );
    expect(kit.relations.followers.get('t-1')?.has('u-mo')).toBe(true);
    expect(kit.relations.tags.get('t-1')).toEqual(['tag-a']);
    expect(kit.publisher.types()).toEqual(['task.assigned', 'task.updated']);
    expect(kit.publisher.events[1]!.payload).toMatchObject({ fields: ['tags', 'epic'] });
  });

  it('rolls subtask completion up to the parent', async () => {
    await seedTask(kit, 'parent', 1);
    await seedTask(kit, 's-1', 2, { parentId: 'parent' });
    await seedTask(kit, 's-2', 3, { parentId: 'parent' });
    await handler.execute(new UpdateTaskCommand(actorOf(), 's-1', { status: 'DONE' }));
    expect((await kit.tasks.findById(WS, 'parent'))!.toSnapshot().progress).toBe(50);
    expect(kit.publisher.types()).toEqual(['task.status_changed', 'task.updated']);
  });

  it('forbids viewers', async () => {
    await seedTask(kit, 't-1', 10);
    await expect(
      handler.execute(new UpdateTaskCommand(actorOf('VIEWER', 'u-viewer'), 't-1', { title: 'Nope' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(kit.publisher.events).toHaveLength(0);
  });
});
