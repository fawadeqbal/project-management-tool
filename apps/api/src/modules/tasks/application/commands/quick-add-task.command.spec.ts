import { actorOf, createKit, creationServiceOf, type TaskTestKit } from '../../testing/task-test-kit';
import { QuickAddTaskCommand, QuickAddTaskHandler } from './quick-add-task.command';

describe('QuickAddTaskHandler', () => {
  let kit: TaskTestKit;
  let handler: QuickAddTaskHandler;

  beforeEach(async () => {
    kit = createKit();
    handler = new QuickAddTaskHandler(await creationServiceOf(kit), kit.directory, kit.clock, kit.read);
  });

  const only = () => kit.tasks.all()[0]!.toSnapshot();

  it('resolves @person, #project, !priority and a date word', async () => {
    await handler.execute(new QuickAddTaskCommand(actorOf(), { text: 'Draft retro agenda @sara #website !high tomorrow', assignToMe: true }));
    expect(only()).toMatchObject({ title: 'Draft retro agenda', assigneeId: 'u-sara', projectId: 'p-web', priority: 'HIGH' });
    expect(only().dueDate?.toISOString().slice(0, 10)).toBe('2026-10-20');
  });

  it('matches initials, first-name prefixes and project words', async () => {
    await handler.execute(new QuickAddTaskCommand(actorOf(), { text: 'Ship it @mk #mobile', assignToMe: true }));
    expect(only()).toMatchObject({ assigneeId: 'u-mo', projectId: 'p-mobile', title: 'Ship it' });
    kit = createKit();
    handler = new QuickAddTaskHandler(await creationServiceOf(kit), kit.directory, kit.clock, kit.read);
    await handler.execute(new QuickAddTaskCommand(actorOf(), { text: 'Brief @sa #brand', assignToMe: true }));
    expect(only()).toMatchObject({ assigneeId: 'u-sara', projectId: 'p-brand' });
  });

  it('keeps unresolved handles in the title and assigns to me', async () => {
    await handler.execute(new QuickAddTaskCommand(actorOf(), { text: 'Call @zed about #nowhere !low', assignToMe: true }));
    expect(only()).toMatchObject({ title: 'Call @zed about #nowhere', assigneeId: 'u-fawad', projectId: null, priority: 'LOW' });
  });

  it('leaves the task unassigned when assignToMe is false', async () => {
    await handler.execute(new QuickAddTaskCommand(actorOf(), { text: 'Loose idea', assignToMe: false }));
    expect(only().assigneeId).toBeNull();
  });
});
