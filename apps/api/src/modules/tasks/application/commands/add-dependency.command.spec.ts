import { ConflictError, ForbiddenError, Task } from '@hearth/domain';
import { actorOf, createKit, TODAY, WS, type TaskTestKit } from '../../testing/task-test-kit';
import { AddDependencyCommand, AddDependencyHandler } from './add-dependency.command';
import { RemoveDependencyCommand, RemoveDependencyHandler } from './remove-dependency.command';

describe('Dependency handlers', () => {
  let kit: TaskTestKit;
  let add: AddDependencyHandler;

  beforeEach(async () => {
    kit = createKit();
    add = new AddDependencyHandler(
      kit.tasks,
      kit.relations,
      kit.clock,
      kit.access,
      kit.publisher.asPublisher(),
      kit.read,
    );
    for (const [id, n] of [
      ['a', 1],
      ['b', 2],
      ['c', 3],
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
    }
  });

  it('links blocker → blocked and notifies both tasks', async () => {
    await add.execute(new AddDependencyCommand(actorOf(), 'b', 'a'));
    expect(kit.relations.edges).toEqual([{ blockerId: 'a', blockedId: 'b' }]);
    expect(kit.publisher.events.map((e) => [e.type, e.aggregateId, e.payload['fields']])).toEqual([
      ['task.updated', 'b', ['dependencies']],
      ['task.updated', 'a', ['dependencies']],
    ]);
  });

  it('rejects a cycle with a ConflictError', async () => {
    await add.execute(new AddDependencyCommand(actorOf(), 'b', 'a'));
    await add.execute(new AddDependencyCommand(actorOf(), 'c', 'b'));
    await expect(add.execute(new AddDependencyCommand(actorOf(), 'a', 'c'))).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(add.execute(new AddDependencyCommand(actorOf(), 'a', 'a'))).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(kit.relations.edges).toHaveLength(2);
  });

  it('forbids viewers', async () => {
    await expect(
      add.execute(new AddDependencyCommand(actorOf('VIEWER', 'u-v'), 'b', 'a')),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('removes a link', async () => {
    await add.execute(new AddDependencyCommand(actorOf(), 'b', 'a'));
    const remove = new RemoveDependencyHandler(
      kit.tasks,
      kit.relations,
      kit.clock,
      kit.access,
      kit.publisher.asPublisher(),
      kit.read,
    );
    await remove.execute(new RemoveDependencyCommand(actorOf(), 'b', 'a'));
    expect(kit.relations.edges).toHaveLength(0);
  });
});
