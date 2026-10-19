import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { RetrospectiveDto, SprintDetailDto, SprintSummaryDto, SprintTaskDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';
import { TEST_DATABASE_URL } from './global-setup';

describe('Sprints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fawad: UserClient;
  let projectId: string;
  let workspaceId: string;
  let sprints: SprintSummaryDto[];
  const byNumber = (n: number) => sprints.find((s) => s.number === n)!;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fawad = await asUser(app, 'fawad@acme.com');
    const project = await prisma.project.findFirstOrThrow({ where: { name: 'Mobile app v2' } });
    projectId = project.id;
    workspaceId = project.workspaceId;
  });
  afterAll(async () => {
    await prisma.subscription.updateMany({ where: { workspaceId }, data: { plan: 'PRO' } });
    await prisma.$disconnect();
    await app.close();
  });

  it('lists the project’s sprints: 21–23 completed, 24 active, 25 planned', async () => {
    sprints = (await fawad.get(`/projects/${projectId}/sprints`).expect(200)).body;
    expect(sprints.map((s) => [s.number, s.status])).toEqual([
      [21, 'COMPLETED'],
      [22, 'COMPLETED'],
      [23, 'COMPLETED'],
      [24, 'ACTIVE'],
      [25, 'PLANNED'],
    ]);
    expect(sprints.slice(0, 3).map((s) => s.completedPoints)).toEqual([34, 40, 39]);
    expect(byNumber(24)).toMatchObject({ committedPoints: 38, scopePoints: 42, taskCount: 8 });
  });

  it('shows Sprint 24 with burndown, scope change, velocity and the capacity warning', async () => {
    const d = (await fawad.get(`/sprints/${byNumber(24).id}`).expect(200)).body as SprintDetailDto;
    expect(d.sprint.goal).toBe('Ship swipe actions and offline edits for beta');
    expect(d.header.statusLabel).toMatch(/^Active · \d+ working days? left$/);
    expect(d.tasks.map((t) => t.key)).toEqual(['HRT-301', 'HRT-302', 'HRT-305', 'HRT-306', 'HRT-308', 'HRT-309', 'HRT-310', 'HRT-311']);
    expect(d.progress).toEqual({ donePoints: 18, totalPoints: 42, donePct: 43 });
    const actual = d.burndown.actual.map((a) => a.remaining);
    expect(actual[0]).toBe(38);
    expect(actual[actual.length - 1]).toBe(24);
    expect(actual).toContain(37);
    expect(d.burndown.ideal[0]!.remaining).toBe(38);
    expect(d.burndown.ideal[d.burndown.ideal.length - 1]!.remaining).toBe(0);
    expect(d.burndown.scopeChanges).toEqual([expect.objectContaining({ addedPoints: 4, remaining: 37 })]);
    expect(d.scopeChanges[0]!.label).toMatch(/\+4 pts/);
    expect(d.velocity.bars.map((b) => [b.label, b.points, b.isPlan])).toEqual([
      ['S21', 34, false],
      ['S22', 40, false],
      ['S23', 39, false],
      ['S24', 42, true],
    ]);
    expect(d.velocity.average).toBe(38);
    expect(d.capacity).toMatchObject({ committed: 42, velocity: 38, level: 'over', deferTask: { key: 'HRT-311' } });
    expect(d.capacity.message).toContain('HRT-311');
  });

  it('returns the ranked backlog and ranks by drag (Pro → 402, Business → ok)', async () => {
    const backlog = (await fawad.get(`/projects/${projectId}/backlog`).expect(200)).body as SprintTaskDto[];
    expect(backlog.map((t) => [t.key, t.points, t.epic])).toEqual([
      ['HRT-320', 8, 'Widgets'],
      ['HRT-322', 5, 'Capture'],
      ['HRT-324', 3, 'Notifications'],
      ['HRT-327', 13, 'Tablet'],
    ]);
    const [t320, , , t327] = backlog;
    const body = { taskId: t327!.id, afterId: t320!.id };
    const denied = await fawad.post(`/projects/${projectId}/backlog/rank`, body).expect(402);
    expect(denied.body.error.kind).toBe('limit_reached');

    await prisma.subscription.updateMany({ where: { workspaceId }, data: { plan: 'BUSINESS' } });
    await fawad.post(`/projects/${projectId}/backlog/rank`, body).expect(201);
    const after = (await fawad.get(`/projects/${projectId}/backlog`).expect(200)).body as SprintTaskDto[];
    expect(after.map((t) => t.key)).toEqual(['HRT-327', 'HRT-320', 'HRT-322', 'HRT-324']);
    await prisma.subscription.updateMany({ where: { workspaceId }, data: { plan: 'PRO' } });
  });

  it('completing a sprint on Pro is refused with limit_reached', async () => {
    const res = await fawad.post(`/sprints/${byNumber(24).id}/complete`, { moveUnfinishedTo: 'backlog' }).expect(402);
    expect(res.body.error).toMatchObject({ kind: 'limit_reached', details: { feature: 'sprints', requiredPlan: 'BUSINESS' } });
    expect(res.body.error.message).toMatch(/Sprints is part of Business/);
  });

  it('on Business: refuses a second active sprint, records scope changes, completes and moves unfinished work', async () => {
    await prisma.subscription.updateMany({ where: { workspaceId }, data: { plan: 'BUSINESS' } });
    const s24 = byNumber(24).id;
    const s25 = byNumber(25).id;

    const conflict = await fawad.post(`/sprints/${s25}/start`).expect(409);
    expect(conflict.body.error.code).toBe('sprint.already_active');

    const backlog = (await fawad.get(`/projects/${projectId}/backlog`).expect(200)).body as SprintTaskDto[];
    const added = backlog.find((t) => t.key === 'HRT-324')!;
    const summary = (await fawad.post(`/sprints/${s24}/tasks`, { taskId: added.id }).expect(201)).body as SprintSummaryDto;
    expect(summary.scopePoints).toBe(45);
    // The snapshot subscriber runs after the response; give it a beat.
    await new Promise((r) => setTimeout(r, 300));
    const detail = (await fawad.get(`/sprints/${s24}`).expect(200)).body as SprintDetailDto;
    expect(detail.burndown.scopeChanges.at(-1)).toMatchObject({ addedPoints: 3 });
    await fawad.delete(`/sprints/${s24}/tasks/${added.id}`).expect(200);

    await fawad.patch(`/sprints/${s25}`, { goal: 'Widgets and share sheet' }).expect(200);

    const retro = (await fawad.post(`/sprints/${s24}/complete`, { moveUnfinishedTo: 'backlog' }).expect(201)).body as RetrospectiveDto;
    expect(retro.sprint.status).toBe('COMPLETED');
    expect(retro.completed.map((t) => t.key).sort()).toEqual(['HRT-301', 'HRT-302', 'HRT-305', 'HRT-309']);
    expect(retro.unfinished.map((t) => t.key)).toEqual(['HRT-308', 'HRT-306', 'HRT-311', 'HRT-310']);
    expect(retro).toMatchObject({ completedPoints: 18, unfinishedPoints: 24, movedTo: { kind: 'backlog', sprint: null } });

    const nowBacklog = (await fawad.get(`/projects/${projectId}/backlog`).expect(200)).body as SprintTaskDto[];
    expect(nowBacklog.slice(0, 4).map((t) => t.key)).toEqual(['HRT-308', 'HRT-306', 'HRT-311', 'HRT-310']);

    const started = (await fawad.post(`/sprints/${s25}/start`).expect(201)).body as SprintSummaryDto;
    expect(started.status).toBe('ACTIVE');

    const planned = (await fawad.post(`/projects/${projectId}/sprints`, {}).expect(201)).body as SprintSummaryDto;
    expect(planned).toMatchObject({ number: 26, status: 'PLANNED', name: 'Sprint 26' });
  });

  it('moves unfinished work into the next sprint when asked', async () => {
    const list = (await fawad.get(`/projects/${projectId}/sprints`).expect(200)).body as SprintSummaryDto[];
    const s25 = list.find((s) => s.number === 25)!;
    const backlog = (await fawad.get(`/projects/${projectId}/backlog`).expect(200)).body as SprintTaskDto[];
    await fawad.post(`/sprints/${s25.id}/tasks`, { taskId: backlog[0]!.id }).expect(201);
    const retro = (await fawad.post(`/sprints/${s25.id}/complete`, { moveUnfinishedTo: 'next' }).expect(201)).body as RetrospectiveDto;
    expect(retro.movedTo).toMatchObject({ kind: 'next', sprint: { number: 26, taskCount: 1 } });
  });
});
