import { ForbiddenError, Task } from '@hearth/domain';
import { actorOf, createKit, TODAY, WS, type TaskTestKit } from '../../testing/task-test-kit';
import { AddCommentCommand, AddCommentHandler } from './add-comment.command';
import { DeleteTaskCommand, DeleteTaskHandler } from './delete-task.command';

describe('AddCommentHandler / DeleteTaskHandler', () => {
  let kit: TaskTestKit;

  beforeEach(async () => {
    kit = createKit();
    const t = Task.create({ id: 't-1', workspaceId: WS, keyPrefix: 'HRT', number: 188, creatorId: 'u-fawad', title: 'Pricing page', projectId: 'p-web' }, TODAY);
    t.pullEvents();
    await kit.tasks.save(t);
  });

  it('publishes comment.created with resolved mentions and auto-follows the author', async () => {
    const handler = new AddCommentHandler(kit.tasks, kit.directory, kit.relations, kit.clock, kit.access, kit.publisher.asPublisher(), kit.read);
    await handler.execute(new AddCommentCommand(actorOf('ADMIN', 'u-sara'), 't-1', { body: '@Fawad and @mo — can you check the toggle? @nobody' }));
    expect(kit.publisher.events).toHaveLength(1);
    const event = kit.publisher.events[0]!;
    expect(event).toMatchObject({ type: 'comment.created', aggregateId: 'c-1', actorId: 'u-sara' });
    expect(event.payload).toEqual({
      taskId: 't-1',
      key: 'HRT-188',
      title: 'Pricing page',
      projectId: 'p-web',
      commentId: 'c-1',
      mentionedUserIds: ['u-fawad', 'u-mo'],
      excerpt: '@Fawad and @mo — can you check the toggle? @nobody',
      parentAuthorId: null,
    });
    expect(kit.relations.followers.get('t-1')?.has('u-sara')).toBe(true);
  });

  it('lets viewers comment but not delete', async () => {
    const comment = new AddCommentHandler(kit.tasks, kit.directory, kit.relations, kit.clock, kit.access, kit.publisher.asPublisher(), kit.read);
    await comment.execute(new AddCommentCommand(actorOf('VIEWER', 'u-v'), 't-1', { body: 'Looks good' }));
    const del = new DeleteTaskHandler(kit.tasks, kit.relations, kit.clock, kit.access, kit.publisher.asPublisher());
    await expect(del.execute(new DeleteTaskCommand(actorOf('VIEWER', 'u-v'), 't-1'))).rejects.toBeInstanceOf(ForbiddenError);
    await del.execute(new DeleteTaskCommand(actorOf(), 't-1'));
    expect(kit.tasks.all()).toHaveLength(0);
    expect(kit.publisher.types()).toEqual(['comment.created', 'task.deleted']);
  });
});
