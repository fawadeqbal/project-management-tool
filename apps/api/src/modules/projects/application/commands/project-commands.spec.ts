import { FixedClock, type Actor } from '@hearth/domain';
import { CapturingPublisher, InMemoryFavorites, InMemoryMilestones, InMemoryProjectRepository, realAccess, teams } from '../testing/fakes';
import { CreateProjectCommand, CreateProjectHandler } from './create-project.handler';
import { UpdateProjectCommand, UpdateProjectHandler } from './update-project.handler';
import { SetFavoriteCommand, SetFavoriteHandler } from './favorite-project.handler';
import { CreateSectionCommand, CreateSectionHandler } from './create-section.handler';
import { UpdateSectionCommand, UpdateSectionHandler } from './update-section.handler';
import { DeleteSectionCommand, DeleteSectionHandler } from './delete-section.handler';
import { CreateMilestoneCommand, CreateMilestoneHandler } from './create-milestone.handler';
import { UpdateMilestoneCommand, UpdateMilestoneHandler } from './update-milestone.handler';

const sara: Actor = { userId: 'sara', workspaceId: 'w1', role: 'ADMIN' };
const viewer: Actor = { userId: 'vic', workspaceId: 'w1', role: 'VIEWER' };
const guest: Actor = { userId: 'tom', workspaceId: 'w1', role: 'GUEST', projectIds: ['other'] };

function setup() {
  const repo = new InMemoryProjectRepository();
  const favorites = new InMemoryFavorites();
  const clock = new FixedClock(new Date('2026-10-19T09:00:00Z'));
  const events = new CapturingPublisher();
  const access = realAccess();
  const create = new CreateProjectHandler(repo, teams(), favorites, clock, access, events.asPublisher());
  return { repo, favorites, clock, events, access, create };
}

describe('project command handlers', () => {
  it('creates a project owned by the actor, favorites it and publishes project.created', async () => {
    const { repo, favorites, events, create } = setup();
    const { id } = await create.execute(new CreateProjectCommand(sara, { name: 'Onboarding revamp', color: 'green', teamId: 't1', dueDate: '2026-12-01' }));
    const snap = repo.saved.get(id)!.toSnapshot();
    expect(snap).toMatchObject({ name: 'Onboarding revamp', ownerId: 'sara', color: 'green', teamId: 't1' });
    expect(favorites.rows.has(`sara:${id}`)).toBe(true);
    expect(events.types).toEqual(['project.created']);
  });

  it('refuses viewers and unknown teams', async () => {
    const { create } = setup();
    await expect(create.execute(new CreateProjectCommand(viewer, { name: 'X', color: 'blue' }))).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(create.execute(new CreateProjectCommand(sara, { name: 'X', color: 'blue', teamId: 'nope' }))).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('updates WIP limits and health, publishing only when something changed', async () => {
    const { repo, clock, events, access, create } = setup();
    const { id } = await create.execute(new CreateProjectCommand(sara, { name: 'Web', color: 'blue' }));
    events.events.length = 0;
    const update = new UpdateProjectHandler(repo, teams(), clock, access, events.asPublisher());
    const res = await update.execute(new UpdateProjectCommand(sara, id, { wipLimits: { IN_PROGRESS: 4 }, health: 'AT_RISK' }));
    expect(res.changed).toEqual(['wipLimits', 'health']);
    expect(events.types).toEqual(['project.health_changed', 'project.updated']);
    events.events.length = 0;
    expect((await update.execute(new UpdateProjectCommand(sara, id, { health: 'AT_RISK' }))).changed).toEqual([]);
    expect(events.types).toEqual([]);
  });

  it('hides projects from guests who were not invited', async () => {
    const { repo, clock, events, access, create, favorites } = setup();
    const { id } = await create.execute(new CreateProjectCommand(sara, { name: 'Web', color: 'blue' }));
    const fav = new SetFavoriteHandler(repo, favorites, clock, access, events.asPublisher());
    await expect(fav.execute(new SetFavoriteCommand(guest, id, true))).rejects.toMatchObject({ kind: 'not_found' });
    await fav.execute(new SetFavoriteCommand(sara, id, false));
    expect(favorites.rows.has(`sara:${id}`)).toBe(false);
  });

  it('adds, reorders and deletes sections through the aggregate', async () => {
    const { repo, clock, events, access, create } = setup();
    const { id } = await create.execute(new CreateProjectCommand(sara, { name: 'Web', color: 'blue' }));
    const add = new CreateSectionHandler(repo, clock, access, events.asPublisher());
    const a = await add.execute(new CreateSectionCommand(sara, id, { name: 'Discovery' }));
    const b = await add.execute(new CreateSectionCommand(sara, id, { name: 'Build' }));
    const c = await add.execute(new CreateSectionCommand(sara, id, { name: 'Design', beforeId: b.id }));
    expect(repo.saved.get(id)!.sections.map((s) => s.name)).toEqual(['Discovery', 'Design', 'Build']);
    await new UpdateSectionHandler(repo, clock, access, events.asPublisher()).execute(new UpdateSectionCommand(sara, c.id, { position: 0, name: 'UX' }));
    expect(repo.saved.get(id)!.sections.map((s) => s.name)).toEqual(['UX', 'Discovery', 'Build']);
    await new DeleteSectionHandler(repo, clock, access, events.asPublisher()).execute(new DeleteSectionCommand(sara, a.id));
    expect(repo.saved.get(id)!.sections.map((s) => [s.name, s.position])).toEqual([['UX', 0], ['Build', 1]]);
    expect(events.types).toContain('project.section_removed');
  });

  it('creates milestones gated by tasks from the same project only', async () => {
    const { repo, clock, events, access, create } = setup();
    const { id } = await create.execute(new CreateProjectCommand(sara, { name: 'Web', color: 'blue' }));
    const store = new InMemoryMilestones(undefined, { [id]: ['t-qa'] });
    const handler = new CreateMilestoneHandler(repo, store, clock, access, events.asPublisher());
    const m = await handler.execute(new CreateMilestoneCommand(sara, id, { name: 'Launch', date: '2026-11-14', dependsOnTaskIds: ['t-qa'] }));
    expect(m).toEqual({ id: 'm1', name: 'Launch', date: '2026-11-14', done: false, dependsOnTaskIds: ['t-qa'] });
    await expect(handler.execute(new CreateMilestoneCommand(sara, id, { name: 'X', date: '2026-11-14', dependsOnTaskIds: ['elsewhere'] }))).rejects.toMatchObject({
      kind: 'validation',
    });
    const done = await new UpdateMilestoneHandler(store, clock, access, events.asPublisher()).execute(new UpdateMilestoneCommand(sara, 'm1', { done: true }));
    expect(done.done).toBe(true);
    expect(events.types).toEqual(expect.arrayContaining(['milestone.created', 'milestone.updated']));
  });
});
