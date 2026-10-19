import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { BoardDto, ProjectDetailDto, ProjectSummaryDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';
import { TEST_DATABASE_URL } from './global-setup';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let prisma: PrismaClient;
  let web: ProjectSummaryDto;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fawad = await asUser(app, 'fawad@acme.com');
    const list = await fawad.get('/projects').expect(200);
    web = (list.body as ProjectSummaryDto[]).find((p) => p.name === 'Website relaunch')!;
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('lists projects with owner, team, health meta, progress, counts and favorites', async () => {
    const list = (await fawad.get('/projects').expect(200)).body as ProjectSummaryDto[];
    expect(list.map((p) => p.name)).toEqual(expect.arrayContaining(['Website relaunch', 'Q4 brand campaign', 'Mobile app v2']));
    expect(web).toMatchObject({
      owner: { name: 'Fawad Iqbal', initials: 'FI' },
      team: { name: 'Design' },
      health: { health: 'AT_RISK', label: 'At risk', icon: 'alert', tone: 'warning' },
      isFavorite: true,
    });
    expect(web.progress).toBeGreaterThan(0);
    expect(web.counts.total).toBe(web.counts.open + web.counts.done);
    expect(web.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the project detail with sections, milestones, members and WIP limits', async () => {
    const d = (await fawad.get(`/projects/${web.id}`).expect(200)).body as ProjectDetailDto;
    expect(d.sections.map((s) => s.name)).toEqual(['Discovery', 'Design', 'Build']);
    expect(d.milestones.map((m) => m.name)).toEqual(['Plan approved', 'Launch']);
    expect(d.milestones[1]!.dependsOnTaskIds).toHaveLength(1);
    expect(d.wipLimits).toEqual({ IN_PROGRESS: 4 });
    expect(d.members[0]).toMatchObject({ name: 'Fawad Iqbal', isOwner: true });
    expect(d.members.map((m) => m.initials)).toEqual(expect.arrayContaining(['SA', 'MK', 'JL']));
    expect(d.suggestedHealth.reason).toEqual(expect.any(String));
    expect(d.slip).toMatchObject({ key: 'HRT-188', days: 2 });
  });

  it('builds board columns ordered by boardPosition with the WIP level', async () => {
    const board = (await fawad.get(`/projects/${web.id}/board`).expect(200)).body as BoardDto;
    expect(board.columns.map((c) => c.label)).toEqual(['To do', 'In progress', 'In review', 'Blocked', 'Done']);
    const progress = board.columns.find((c) => c.status === 'IN_PROGRESS')!;
    expect(progress.wipLimit).toBe(4);
    expect(progress.count).toBe(progress.tasks.length);
    expect(progress.wipLevel).toBe(progress.count > 4 ? 'over' : progress.count >= 3 ? 'near' : 'ok');
    expect(progress.tasks.map((t) => t.key)).toContain('HRT-188');
    const positions = progress.tasks.map((t) => t.boardPosition);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(board.columns.find((c) => c.status === 'TODO')!.wipLevel).toBe('ok');
  });

  it('favorites and unfavorites a project', async () => {
    const brand = ((await fawad.get('/projects').expect(200)).body as ProjectSummaryDto[]).find((p) => p.name === 'Q4 brand campaign')!;
    await fawad.delete(`/projects/${brand.id}/favorite`).expect(200, { isFavorite: false });
    let after = ((await fawad.get('/projects')).body as ProjectSummaryDto[]).find((p) => p.id === brand.id)!;
    expect(after.isFavorite).toBe(false);
    await fawad.post(`/projects/${brand.id}/favorite`).expect(200, { isFavorite: true });
    after = ((await fawad.get('/projects')).body as ProjectSummaryDto[]).find((p) => p.id === brand.id)!;
    expect(after.isFavorite).toBe(true);
  });

  it('creates a project, edits it, and manages sections and milestones', async () => {
    const sara = await asUser(app, 'sara@acme.com');
    const created = await sara.post('/projects', { name: 'Help center', color: 'green', dueDate: '2026-12-15' }).expect(201);
    const p = created.body as ProjectDetailDto;
    expect(p).toMatchObject({ name: 'Help center', owner: { name: 'Sara Ahmed' }, isFavorite: true, health: { label: 'On track' } });

    const bad = await sara.post('/projects', { name: '' }).expect(400);
    expect(bad.body.error.fieldErrors.name).toBeDefined();

    const edited = (await sara.patch(`/projects/${p.id}`, { name: 'Help centre', health: 'AT_RISK', wipLimits: { IN_REVIEW: 2 } }).expect(200)).body as ProjectDetailDto;
    expect(edited).toMatchObject({ name: 'Help centre', health: { health: 'AT_RISK' }, wipLimits: { IN_REVIEW: 2 } });
    await sara.patch(`/projects/${p.id}`, { wipLimits: { DONE: 2 } }).expect(400);

    const s1 = (await sara.post(`/projects/${p.id}/sections`, { name: 'Articles' }).expect(201)).body;
    const s2 = (await sara.post(`/projects/${p.id}/sections`, { name: 'Search', beforeId: s1.id }).expect(201)).body;
    await sara.patch(`/sections/${s2.id}`, { position: 1 }).expect(200);
    let detail = (await sara.get(`/projects/${p.id}`)).body as ProjectDetailDto;
    expect(detail.sections.map((s) => s.name)).toEqual(['Articles', 'Search']);
    await sara.delete(`/sections/${s1.id}`).expect(204);

    const m = (await sara.post(`/projects/${p.id}/milestones`, { name: 'Beta', date: '2026-11-30' }).expect(201)).body;
    await sara.patch(`/milestones/${m.id}`, { done: true }).expect(200);
    detail = (await sara.get(`/projects/${p.id}`)).body as ProjectDetailDto;
    expect(detail.sections.map((s) => s.name)).toEqual(['Search']);
    expect(detail.milestones).toEqual([expect.objectContaining({ name: 'Beta', done: true })]);
    await sara.delete(`/milestones/${m.id}`).expect(204);
  });

  it('lists a team’s projects', async () => {
    const teams = (await fawad.get('/teams').expect(200)).body as { id: string; name: string }[];
    const design = teams.find((t) => t.name === 'Design')!;
    const res = (await fawad.get(`/teams/${design.id}/projects`).expect(200)).body as ProjectSummaryDto[];
    expect(res.map((p) => p.name)).toContain('Website relaunch');
    expect(res.every((p) => p.team?.id === design.id)).toBe(true);
    await fawad.get('/teams/nope/projects').expect(404);
  });

  it('shows guest Tom only Website relaunch', async () => {
    const tom = await asUser(app, 'tom@northwind.co');
    const list = (await tom.get('/projects').expect(200)).body as ProjectSummaryDto[];
    expect(list.map((p) => p.name)).toEqual(['Website relaunch']);
    const brand = ((await fawad.get('/projects')).body as ProjectSummaryDto[]).find((p) => p.name === 'Q4 brand campaign')!;
    await tom.get(`/projects/${brand.id}`).expect(404);
    await tom.get(`/projects/${brand.id}/board`).expect(404);
    await tom.get(`/projects/${web.id}/board`).expect(200);
    await tom.post('/projects', { name: 'Sneaky' }).expect(403);
  });

  it('doesn’t let a viewer create a project', async () => {
    const ravi = await prisma.user.findUniqueOrThrow({ where: { email: 'ravi@acme.com' } });
    await prisma.membership.updateMany({ where: { userId: ravi.id }, data: { role: 'VIEWER' } });
    try {
      const viewer = await asUser(app, 'ravi@acme.com');
      const res = await viewer.post('/projects', { name: 'Not allowed' }).expect(403);
      expect(res.body.error.kind).toBe('forbidden');
      await viewer.get('/projects').expect(200);
    } finally {
      await prisma.membership.updateMany({ where: { userId: ravi.id }, data: { role: 'MEMBER' } });
    }
  });
});
