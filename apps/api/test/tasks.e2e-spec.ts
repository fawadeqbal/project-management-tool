import type { INestApplication } from '@nestjs/common';
import type { CommentDto, TaskDetailDto, TaskDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';

const tomorrow = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);
};

/**
 * Tasks context against the seeded Acme Studio workspace. Writes use tasks created here, so
 * the seeded data other suites rely on (HRT-188 and friends) stays as it was.
 */
describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let projects: Record<string, string>;
  let me: { id: string };
  let people: Record<string, string>;
  /** Tasks this suite creates — deleted afterwards so other suites see the pristine seed. */
  const created: string[] = [];
  const track = <T extends { body: { id: string } }>(res: T): T => {
    created.push(res.body.id);
    return res;
  };

  const detailByKey = async (key: string): Promise<TaskDetailDto> => (await fawad.get(`/tasks/key/${key}`).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
    fawad = await asUser(app);
    me = (await fawad.get('/me').expect(200)).body.user;
    const members: Array<{ id: string; name: string }> = (await fawad.get('/members').expect(200)).body;
    people = Object.fromEntries(members.map((m) => [m.name.split(' ')[0]!, m.id]));
    const all: TaskDto[] = (await fawad.get('/tasks?scope=workspace&limit=500').expect(200)).body;
    projects = Object.fromEntries(all.filter((t) => t.project).map((t) => [t.project!.name, t.project!.id]));
  });
  afterAll(async () => {
    for (const id of created.reverse()) await fawad.delete(`/tasks/${id}`);
    await app.close();
  });

  it('lists my open tasks', async () => {
    const res = await fawad.get('/tasks').expect(200);
    const tasks: TaskDto[] = res.body;
    expect(tasks.map((t) => t.key)).toEqual(
      expect.arrayContaining(['HRT-118', 'HRT-142', 'HRT-151', 'HRT-139', 'HRT-160', 'HRT-163', 'HRT-174', 'HRT-171', 'HRT-188']),
    );
    expect(tasks.every((t) => t.assigneeId === me.id && t.status !== 'DONE' && t.parentId === null)).toBe(true);
    const t188 = tasks.find((t) => t.key === 'HRT-188')!;
    expect(t188).toMatchObject({ subtaskCount: 4, subtaskDoneCount: 2, commentCount: 3, project: { name: 'Website relaunch' } });
    expect(t188.tags.map((t) => t.name)).toEqual(['Design', 'Pricing']);
  });

  it('filters by project, status, dates and text', async () => {
    const web = projects['Website relaunch']!;
    const project: TaskDto[] = (await fawad.get(`/tasks?scope=project&projectId=${web}`).expect(200)).body;
    expect(project.every((t) => t.projectId === web)).toBe(true);
    expect(project.some((t) => t.status === 'DONE')).toBe(true); // project scope includes done by default

    const open: TaskDto[] = (await fawad.get(`/tasks?scope=project&projectId=${web}&includeDone=false`).expect(200)).body;
    expect(open.some((t) => t.status === 'DONE')).toBe(false);

    const byText: TaskDto[] = (await fawad.get('/tasks?scope=workspace&q=HRT-188').expect(200)).body;
    expect(byText.map((t) => t.key)).toEqual(['HRT-188']);

    const subtasks: TaskDto[] = (await fawad.get(`/tasks?scope=workspace&includeDone=true&parentId=${byText[0]!.id}`).expect(200)).body;
    expect(subtasks.map((t) => t.key)).toEqual(['HRT-189', 'HRT-190', 'HRT-191', 'HRT-193']);

    await fawad.get('/tasks?scope=project').expect(400);
  });

  it('returns the full task by key', async () => {
    const task = await detailByKey('HRT-188');
    expect(task.title).toBe('Design pricing page in light and dark mode');
    expect(task.subtasks.map((s) => s.key)).toEqual(['HRT-189', 'HRT-190', 'HRT-191', 'HRT-193']);
    expect(task.blockedBy.map((b) => b.key)).toContain('HRT-182');
    expect(task.blocking.map((b) => b.key)).toContain('HRT-192');
    expect(task.comments).toHaveLength(3);
    const sara = task.comments.find((c) => c.body.startsWith('@Fawad'))!;
    expect(sara.author.name).toBe('Sara Ahmed');
    expect(sara.mentions.map((m) => m.name)).toEqual(['Fawad Iqbal']);
    expect(task.activity.map((a) => a.summary)).toEqual(expect.arrayContaining(['created this task', 'changed status to In progress']));
    expect(task.followerIds).toEqual(expect.arrayContaining([me.id, people['Sara'], people['Mo']]));
    expect(task.creator.name).toBe('Fawad Iqbal');

    const byId = await fawad.get(`/tasks/${task.id}`).expect(200);
    expect(byId.body.key).toBe('HRT-188');
    await fawad.get('/tasks/key/HRT-99999').expect(404);
  });

  it('quick adds with people, project, priority and date', async () => {
    const res = track(await fawad.post('/tasks/quick-add', { text: 'Draft retro agenda @sara #website !high tomorrow' }).expect(201));
    const task: TaskDto = res.body;
    expect(task).toMatchObject({
      title: 'Draft retro agenda',
      assignee: { name: 'Sara Ahmed' },
      project: { name: 'Website relaunch' },
      priority: 'HIGH',
      dueDate: tomorrow(),
      status: 'TODO',
    });
    expect(task.key).toMatch(/^HRT-\d+$/);
    expect(task.number).toBeGreaterThan(327);

    const mine = track(await fawad.post('/tasks/quick-add', { text: 'Book a room @nobody' }).expect(201));
    expect(mine.body).toMatchObject({ title: 'Book a room @nobody', assigneeId: me.id });
  });

  it('creates, completes and records activity', async () => {
    const res = track(await fawad.post('/tasks', { title: 'Write launch FAQ', projectId: projects['Website relaunch'], priority: 'MEDIUM' }).expect(201));
    const task: TaskDetailDto = res.body;
    expect(task.followerIds).toContain(me.id);

    const done = await fawad.patch(`/tasks/${task.id}`, { status: 'DONE', dueDate: '2026-12-01', assigneeId: people['Mo'] }).expect(200);
    expect(done.body.status).toBe('DONE');
    expect(done.body.completedAt).toEqual(expect.any(String));
    expect(done.body.progress).toBe(100);
    expect(done.body.followerIds).toContain(people['Mo']);

    // The activity log is written by an event subscriber; give it a moment.
    await new Promise((r) => setTimeout(r, 200));
    const detail: TaskDetailDto = (await fawad.get(`/tasks/${task.id}`).expect(200)).body;
    expect(detail.activity.map((a) => a.summary)).toEqual(
      expect.arrayContaining(['created this task', 'changed status to Done', 'assigned this to Mo Khan', 'rescheduled to Dec 1']),
    );
  });

  it('moves a card between neighbours on the board', async () => {
    const make = async (title: string) =>
      (track(await fawad.post('/tasks', { title, projectId: projects['Q4 brand campaign'], status: 'IN_REVIEW' }).expect(201))).body as TaskDetailDto;
    const a = await make('Board A');
    const b = await make('Board B');
    const c = track(await fawad.post('/tasks', { title: 'Board C', projectId: projects['Q4 brand campaign'] }).expect(201));

    const res = await fawad.post(`/tasks/${c.body.id}/move`, { status: 'IN_REVIEW', beforeId: a.id, afterId: b.id }).expect(200);
    expect(res.body.status).toBe('IN_REVIEW');
    expect(res.body.boardPosition).toBeGreaterThan(a.boardPosition);
    expect(res.body.boardPosition).toBeLessThan(b.boardPosition);
  });

  it('adds a comment that mentions someone', async () => {
    const task = (track(await fawad.post('/tasks', { title: 'Comment target', projectId: projects['Mobile app v2'] }).expect(201))).body as TaskDetailDto;
    const res = await fawad.post(`/tasks/${task.id}/comments`, { body: '@Mo can you take a look?' }).expect(201);
    const comment: CommentDto = res.body;
    expect(comment.mentions.map((m) => m.name)).toEqual(['Mo Khan']);
    expect(comment.author.name).toBe('Fawad Iqbal');

    const detail: TaskDetailDto = (await fawad.get(`/tasks/${task.id}`).expect(200)).body;
    expect(detail.commentCount).toBe(1);
  });

  it('links dependencies and refuses cycles', async () => {
    const t188 = await detailByKey('HRT-188');
    const t192 = await detailByKey('HRT-192');
    const res = await fawad.post(`/tasks/${t188.id}/dependencies`, { blockerId: t192.id }).expect(409);
    expect(res.body.error).toMatchObject({ kind: 'conflict', code: 'dependency.cycle' });

    const x = (track(await fawad.post('/tasks', { title: 'Dep X', projectId: projects['Website relaunch'] }).expect(201))).body as TaskDetailDto;
    const y = (track(await fawad.post('/tasks', { title: 'Dep Y', projectId: projects['Website relaunch'] }).expect(201))).body as TaskDetailDto;
    const linked = await fawad.post(`/tasks/${y.id}/dependencies`, { blockerId: x.id }).expect(201);
    expect(linked.body.blockedBy.map((b: { key: string }) => b.key)).toEqual([x.key]);
    await fawad.post(`/tasks/${x.id}/dependencies`, { blockerId: y.id }).expect(409);
    const unlinked = await fawad.delete(`/tasks/${y.id}/dependencies/${x.id}`).expect(200);
    expect(unlinked.body.blockedBy).toEqual([]);
  });

  it('follows, unfollows and deletes', async () => {
    const task = (track(await fawad.post('/tasks', { title: 'Short-lived', assigneeId: null }).expect(201))).body as TaskDetailDto;
    await fawad.delete(`/tasks/${task.id}/follow`).expect(200);
    expect((await fawad.get(`/tasks/${task.id}`).expect(200)).body.followerIds).not.toContain(me.id);
    await fawad.put(`/tasks/${task.id}/follow`).expect(200);
    expect((await fawad.get(`/tasks/${task.id}`).expect(200)).body.followerIds).toContain(me.id);
    await fawad.delete(`/tasks/${task.id}`).expect(204);
    await fawad.get(`/tasks/${task.id}`).expect(404);
  });

  it('confines guests to the projects they were invited to', async () => {
    const tom = await asUser(app, 'tom@northwind.co');
    const tasks: TaskDto[] = (await tom.get('/tasks?scope=workspace&includeDone=true').expect(200)).body;
    expect(tasks.length).toBeGreaterThan(0);
    expect(new Set(tasks.map((t) => t.project?.name))).toEqual(new Set(['Website relaunch']));

    const mobileTask = (await fawad.get(`/tasks?scope=project&projectId=${projects['Mobile app v2']}`).expect(200)).body[0] as TaskDto;
    const res = await tom.get(`/tasks/${mobileTask.id}`);
    expect([403, 404]).toContain(res.status);
    await tom.get(`/tasks?scope=project&projectId=${projects['Mobile app v2']}`).expect(403);
    await tom.patch(`/tasks/${mobileTask.id}`, { title: 'Hijacked' }).expect(403);
    await tom.post('/tasks', { title: 'Sneaky', projectId: projects['Mobile app v2'] }).expect(403);
    await tom.post('/tasks', { title: 'No project' }).expect(403);
  });

  it('answers invalid input with the validation envelope', async () => {
    const res = await fawad.post('/tasks', { title: '' }).expect(400);
    expect(res.body.error).toMatchObject({ kind: 'validation', code: 'validation.failed' });
    expect(res.body.error.fieldErrors.title).toEqual([expect.stringMatching(/title/i)]);
    await fawad.post('/tasks', { title: 'Ghost project', projectId: 'nope' }).expect(404);
    await fawad.patch('/tasks/whatever', { priority: 'SOMETIMES' }).expect(400);
  });
});
