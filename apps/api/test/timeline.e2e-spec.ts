import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { ProjectSummaryDto, RescheduleResultDto, TimelineDto, TimelineTaskRowDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';
import { TEST_DATABASE_URL } from './global-setup';

describe('Timeline (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let prisma: PrismaClient;
  let webId: string;
  let workspaceId: string;
  let originalPlan: string | null;

  const setPlan = async (plan: 'FREE' | 'PRO') =>
    prisma.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan, renewsAt: new Date(Date.now() + 30 * 86_400_000) },
      update: { plan },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fawad = await asUser(app, 'fawad@acme.com');
    webId = ((await fawad.get('/projects')).body as ProjectSummaryDto[]).find((p) => p.name === 'Website relaunch')!.id;
    workspaceId = (await prisma.project.findUniqueOrThrow({ where: { id: webId } })).workspaceId;
    originalPlan = (await prisma.subscription.findUnique({ where: { workspaceId } }))?.plan ?? null;
  });
  afterAll(async () => {
    if (originalPlan) await prisma.subscription.update({ where: { workspaceId }, data: { plan: originalPlan as 'FREE' } });
    else await prisma.subscription.deleteMany({ where: { workspaceId } });
    await prisma.$disconnect();
    await app.close();
  });

  const timeline = async () => (await fawad.get(`/projects/${webId}/timeline`).expect(200)).body as TimelineDto;
  const taskRow = (t: TimelineDto, key: string) => t.rows.find((r): r is TimelineTaskRowDto => r.kind === 'task' && r.key === key)!;

  it('returns rows in section order with milestones, links, the critical path and conflicts', async () => {
    const t = await timeline();
    const sections = t.rows.filter((r) => r.kind === 'section').map((r) => (r as { name: string }).name);
    expect(sections).toEqual(['Discovery', 'Design', 'Build']);
    const names = t.rows.map((r) => (r.kind === 'task' ? r.key : r.name));
    expect(names.indexOf('Plan approved')).toBeLessThan(names.indexOf('Design'));
    expect(names[names.length - 1]).toBe('Launch');

    const pricing = taskRow(t, 'HRT-188');
    const nav = taskRow(t, 'HRT-192');
    const qa = taskRow(t, 'HRT-209');
    const launch = t.rows.find((r) => r.kind === 'milestone' && r.name === 'Launch')!;
    // pricing → navigation → QA → Launch is the critical chain.
    for (const id of [pricing.id, nav.id, qa.id, launch.id]) expect(t.criticalIds).toContain(id);
    expect(t.criticalIds.indexOf(pricing.id)).toBeLessThan(t.criticalIds.indexOf(nav.id));
    expect(t.criticalIds.indexOf(nav.id)).toBeLessThan(t.criticalIds.indexOf(qa.id));
    expect(taskRow(t, 'HRT-204').critical).toBe(false);
    expect(pricing).toMatchObject({ baselineStart: expect.any(String), assignee: { initials: 'FI' } });

    expect(t.links).toEqual(expect.arrayContaining([{ fromId: pricing.id, toId: nav.id, critical: true }, { fromId: qa.id, toId: launch.id, critical: true }]));
    const analytics = taskRow(t, 'HRT-195');
    expect(t.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ taskId: analytics.id, blockerKey: 'HRT-192' })]));
    expect(t.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gates rescheduling behind the Pro plan (reads stay open)', async () => {
    await setPlan('FREE');
    const pricing = taskRow(await timeline(), 'HRT-188');
    const res = await fawad.post(`/timeline/tasks/${pricing.id}/reschedule`, { startDate: pricing.startDate, dueDate: pricing.dueDate, shiftDependents: true }).expect(402);
    expect(res.body.error).toMatchObject({ kind: 'limit_reached', details: { feature: 'timeline', requiredPlan: 'PRO' } });
  });

  it('reschedules a task, shifts its dependents, publishes events and can be undone', async () => {
    await setPlan('PRO');
    const before = await timeline();
    const pricing = taskRow(before, 'HRT-188');
    const nav = taskRow(before, 'HRT-192');
    const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

    const res = (await fawad
      .post(`/timeline/tasks/${pricing.id}/reschedule`, { startDate: plus(pricing.startDate, 2), dueDate: plus(pricing.dueDate, 2), shiftDependents: true })
      .expect(200)).body as RescheduleResultDto;
    expect(res.task).toMatchObject({ label: 'HRT-188', days: 2 });
    expect(res.shifted.map((s) => s.key)).toEqual(expect.arrayContaining(['HRT-192', 'HRT-209', 'Launch']));
    expect(res.shifted.find((s) => s.key === 'HRT-192')!.days).toBe(2);

    const after = await timeline();
    expect(taskRow(after, 'HRT-192').startDate).toBe(plus(nav.startDate, 2));

    // task.rescheduled went through the event bus → the activity recorder logged it.
    const activity = await prisma.activity.findMany({ where: { taskId: nav.id, type: 'task.rescheduled' } });
    expect(activity.length).toBeGreaterThan(0);
    expect(activity.at(-1)!.payload).toMatchObject({ key: 'HRT-192', startDate: plus(nav.startDate, 2) });

    await fawad.post('/timeline/schedule', { items: res.previous }).expect(200);
    const restored = await timeline();
    expect(taskRow(restored, 'HRT-188').startDate).toBe(pricing.startDate);
    expect(taskRow(restored, 'HRT-192').startDate).toBe(nav.startDate);
  });

  it('validates dates and hides other projects from guests', async () => {
    const pricing = taskRow(await timeline(), 'HRT-188');
    await fawad.post(`/timeline/tasks/${pricing.id}/reschedule`, { startDate: '2026-11-10', dueDate: '2026-11-01' }).expect(400);
    const tom = await asUser(app, 'tom@northwind.co');
    await tom.get(`/projects/${webId}/timeline`).expect(200);
    const brand = ((await fawad.get('/projects')).body as ProjectSummaryDto[]).find((p) => p.name === 'Q4 brand campaign')!;
    await tom.get(`/projects/${brand.id}/timeline`).expect(404);
  });
});
