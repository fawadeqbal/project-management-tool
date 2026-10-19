import { NotFoundError, Task } from '@hearth/domain';
import { actorOf, createKit, TODAY, WS, type TaskTestKit } from '../../testing/task-test-kit';
import { MoveTaskCommand, MoveTaskHandler } from './move-task.command';

describe('MoveTaskHandler', () => {
  let kit: TaskTestKit;
  let handler: MoveTaskHandler;

  beforeEach(async () => {
    kit = createKit();
    handler = new MoveTaskHandler(
      kit.tasks,
      kit.relations,
      kit.clock,
      kit.access,
      kit.publisher.asPublisher(),
      kit.read,
    );
    for (const [id, n, pos] of [
      ['a', 1, 1000],
      ['b', 2, 2000],
      ['moving', 3, 5000],
    ] as const) {
      const t = Task.create(
        {
          id,
          workspaceId: WS,
          keyPrefix: 'HRT',
          number: n,
          creatorId: 'u-fawad',
          title: id,
          projectId: 'p-web',
        },
        TODAY,
      );
      t.pullEvents();
      await kit.tasks.save(t);
      await kit.relations.setOrdering(id, { boardPosition: pos, listPosition: pos });
    }
  });

  it('places the task between its neighbours and changes the column', async () => {
    await handler.execute(
      new MoveTaskCommand(actorOf(), 'moving', {
        status: 'IN_REVIEW',
        beforeId: 'a',
        afterId: 'b',
        ordering: 'board',
      }),
    );
    expect(kit.relations.ordering.get('moving')!.boardPosition).toBe(1500);
    expect(kit.relations.ordering.get('moving')!.listPosition).toBe(5000);
    expect((await kit.tasks.findById(WS, 'moving'))!.status).toBe('IN_REVIEW');
    expect(kit.publisher.types()).toEqual(['task.status_changed', 'task.updated']);
  });

  it('reorders lists at the top edge', async () => {
    await handler.execute(new MoveTaskCommand(actorOf(), 'moving', { afterId: 'a', ordering: 'list' }));
    expect(kit.relations.ordering.get('moving')!.listPosition).toBe(1000 - 1024);
    expect(kit.publisher.types()).toEqual(['task.updated']);
  });

  it('rejects unknown neighbours', async () => {
    await expect(
      handler.execute(new MoveTaskCommand(actorOf(), 'moving', { beforeId: 'ghost', ordering: 'board' })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
