import type { INestApplication } from '@nestjs/common';
import { asUser, createTestApp, type UserClient } from './utils';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  beforeAll(async () => {
    app = await createTestApp();
    fawad = await asUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('shows 3 of 5 done with "Invite 2 teammates" as the single next step', async () => {
    const { body } = await fawad.get('/onboarding').expect(200);
    expect(body).toMatchObject({ completed: 3, total: 5, nextStep: 'Invite 2 teammates', isComplete: false, dismissed: false });
    expect(body.steps.filter((s: { isNext: boolean }) => s.isNext).map((s: { id: string }) => s.id)).toEqual(['invite-teammates']);
    expect(body.steps.find((s: { id: string }) => s.id === 'create-first-task').hint).toMatch(/^HRT-\d+ · /);
    const shell = await fawad.get('/shell').expect(200);
    expect(shell.body.onboarding).toMatchObject({ completed: 3, total: 5, nextStep: 'Invite 2 teammates' });
  });

  it('lists 3–6 templates with the design’s three featured', async () => {
    const { body } = await fawad.get('/templates').expect(200);
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(body.length).toBeLessThanOrEqual(6);
    expect(body.filter((t: { featured: boolean }) => t.featured).map((t: { name: string }) => t.name)).toEqual(['Product sprint', 'Marketing campaign', 'Client project']);
  });

  it('applies a template: a project with sections and starter tasks, numbered from the workspace sequence', async () => {
    const res = await fawad.post('/templates/website-launch/apply', { name: 'Docs site launch' }).expect(201);
    expect(res.body).toMatchObject({ project: { name: 'Docs site launch', color: 'blue' }, taskCount: 10 });
    expect(res.body.firstTaskKey).toMatch(/^HRT-\d+$/);
    const export_ = await fawad.get('/billing/export').expect(200);
    const tasks = export_.body.tasks.filter((t: { project: string }) => t.project === 'Docs site launch');
    expect(tasks).toHaveLength(10);
    expect(new Set(tasks.map((t: { section: string }) => t.section))).toEqual(new Set(['Discovery', 'Design', 'Build', 'Launch']));
    const numbers = tasks.map((t: { key: string }) => Number(t.key.split('-')[1]));
    expect(Math.min(...numbers)).toBeGreaterThan(95);
    const shell = await fawad.get('/shell').expect(200);
    expect(shell.body.favorites.map((p: { name: string }) => p.name)).toContain('Docs site launch');
    await fawad.post('/templates/nope/apply', {}).expect(404);
  });

  it('completes and dismisses steps', async () => {
    await fawad.post('/onboarding/steps/teleport/complete').expect(400);
    const done = await fawad.post('/onboarding/steps/connect-slack/complete').expect(200);
    expect(done.body.completed).toBe(4);
    expect(done.body.steps.find((s: { isNext: boolean }) => s.isNext).id).toBe('invite-teammates');
    expect((await fawad.post('/onboarding/dismiss').expect(200)).body.dismissed).toBe(true);
  });

  it('keeps a separate checklist per person', async () => {
    const sara = await asUser(app, 'sara@acme.com');
    const { body } = await sara.get('/onboarding').expect(200);
    expect(body.total).toBe(5);
  });
});
