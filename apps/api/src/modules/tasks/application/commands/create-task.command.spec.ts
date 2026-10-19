import { ForbiddenError, NotFoundError } from '@hearth/domain';
import { actorOf, createKit, creationServiceOf, WS, type TaskTestKit } from '../../testing/task-test-kit';
import { CreateTaskCommand, CreateTaskHandler } from './create-task.command';

describe('CreateTaskHandler', () => {
  let kit: TaskTestKit;
  let handler: CreateTaskHandler;

  beforeEach(async () => {
    kit = createKit();
    handler = new CreateTaskHandler(await creationServiceOf(kit), kit.read);
  });

  it('creates a task with the next number and emits task.created', async () => {
    await handler.execute(new CreateTaskCommand(actorOf(), { title: 'Write launch FAQ', projectId: 'p-web', assigneeId: 'u-sara', priority: 'HIGH' }));

    const [task] = kit.tasks.all();
    expect(task!.key.toString()).toBe('HRT-328');
    expect(task!.toSnapshot()).toMatchObject({ projectId: 'p-web', assigneeId: 'u-sara', priority: 'HIGH', creatorId: 'u-fawad' });
    expect(kit.publisher.types()).toEqual(['task.created']);
    expect(kit.publisher.events[0]!.payload).toEqual({ key: 'HRT-328', title: 'Write launch FAQ', projectId: 'p-web', assigneeId: 'u-sara' });
    expect([...kit.relations.followers.get(task!.id)!]).toEqual(['u-fawad', 'u-sara']);
  });

  it('appends new tasks at the end of their column', async () => {
    await handler.execute(new CreateTaskCommand(actorOf(), { title: 'First', projectId: 'p-web' }));
    await handler.execute(new CreateTaskCommand(actorOf(), { title: 'Second', projectId: 'p-web' }));
    const [a, b] = kit.tasks.all();
    expect(kit.relations.ordering.get(b!.id)!.boardPosition).toBeGreaterThan(kit.relations.ordering.get(a!.id)!.boardPosition);
    expect(kit.relations.ordering.get(b!.id)!.listPosition).toBeGreaterThan(kit.relations.ordering.get(a!.id)!.listPosition);
  });

  it('rejects references outside the workspace', async () => {
    await expect(handler.execute(new CreateTaskCommand(actorOf(), { title: 'X', projectId: 'p-elsewhere' }))).rejects.toBeInstanceOf(NotFoundError);
    expect(kit.tasks.all()).toHaveLength(0);
  });

  it('forbids viewers and confines guests to their projects', async () => {
    await expect(handler.execute(new CreateTaskCommand(actorOf('VIEWER'), { title: 'X' }))).rejects.toBeInstanceOf(ForbiddenError);
    const guest = actorOf('GUEST', 'u-tom', ['p-web']);
    await expect(handler.execute(new CreateTaskCommand(guest, { title: 'X', projectId: 'p-mobile' }))).rejects.toBeInstanceOf(ForbiddenError);
    await handler.execute(new CreateTaskCommand(guest, { title: 'Ok', projectId: 'p-web' }));
    expect(kit.tasks.all().map((t) => t.workspaceId)).toEqual([WS]);
  });
});
