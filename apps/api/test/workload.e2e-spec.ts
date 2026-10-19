import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { TimeOffDto, WorkloadDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';
import { TEST_DATABASE_URL } from './global-setup';

describe('Workload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fawad: UserClient;
  let mo: UserClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fawad = await asUser(app, 'fawad@acme.com');
    mo = await asUser(app, 'mo@acme.com');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const thisWeek = (w: WorkloadDto) => w.days.slice(0, 5).map((d) => d.date);

  it('shows everyone over two working weeks with this week’s overloads and time off', async () => {
    const res = await fawad.get('/workload').expect(200);
    const w = res.body as WorkloadDto;
    expect(w.days).toHaveLength(10);
    expect(w.days[0]!.isToday).toBe(true);
    expect(w.days[5]!.weekStart).toBe(true);
    expect(w.people.map((p) => p.user.name)).toEqual(expect.arrayContaining(['Fawad Iqbal', 'Sara Ahmed', 'Mo Khan', 'Jia Li', 'Ravi Teja', 'Nadia Bashir']));
    expect(w.people.find((p) => p.user.name === 'Tom Walsh')).toBeUndefined();

    const week = new Set(thisWeek(w));
    const overThisWeek = w.summary.overCapacity.filter((o) => o.days.some((d) => week.has(d))).map((o) => o.user.name);
    expect(overThisWeek).toEqual(expect.arrayContaining(['Mo Khan', 'Sara Ahmed']));

    const mo = w.people.find((p) => p.user.name === 'Mo Khan')!;
    expect(mo.capacityHoursPerDay).toBe(8);
    expect(mo.cells.some((c) => c.state === 'over' && c.items.length > 0)).toBe(true);

    const jia = w.people.find((p) => p.user.name === 'Jia Li')!;
    expect(jia.cells.slice(3, 5).map((c) => c.state)).toEqual(['off', 'off']);
    expect(w.summary.timeOff).toEqual([expect.objectContaining({ user: expect.objectContaining({ name: 'Jia Li' }), label: expect.stringMatching(/^Thu \d+ – Fri \d+$/) })]);

    expect(w.suggestions.length).toBeGreaterThan(0);
    expect(w.suggestions[0]).toMatchObject({ source: 'based on this week’s estimates', task: { key: expect.stringMatching(/^HRT-\d+$/) } });
    for (const s of w.suggestions) expect(w.tasks[s.task.id]).toBeDefined();
  });

  it('narrows to a project: Website relaunch', async () => {
    const web = await prisma.project.findFirstOrThrow({ where: { name: 'Website relaunch' } });
    const w = (await fawad.get(`/workload?projectId=${web.id}`).expect(200)).body as WorkloadDto;
    const names = w.people.map((p) => p.user.name);
    expect(names).toEqual(expect.arrayContaining(['Mo Khan', 'Sara Ahmed']));
    expect(names.length).toBeLessThanOrEqual(6);
  });

  it('counts tasks and points in the other units', async () => {
    const tasks = (await fawad.get('/workload?unit=tasks').expect(200)).body as WorkloadDto;
    expect(tasks.unit).toBe('tasks');
    const cell = tasks.people.flatMap((p) => p.cells).find((c) => c.planned > 0)!;
    expect(Number.isInteger(cell.planned)).toBe(true);
    await fawad.get('/workload?unit=bananas').expect(400);
  });

  it('lets members add and remove their own time off, but not someone else’s', async () => {
    const created = await mo.post('/time-off', { startDate: '2027-01-04', endDate: '2027-01-05', reason: 'Dentist' }).expect(201);
    const dto = created.body as TimeOffDto;
    expect(dto).toMatchObject({ user: { name: 'Mo Khan' }, startDate: '2027-01-04', endDate: '2027-01-05' });

    const sara = await prisma.user.findUniqueOrThrow({ where: { email: 'sara@acme.com' } });
    const denied = await mo.post('/time-off', { userId: sara.id, startDate: '2027-01-04', endDate: '2027-01-04' }).expect(403);
    expect(denied.body.error.kind).toBe('forbidden');

    await mo.post('/time-off', { startDate: '2027-01-05', endDate: '2027-01-06' }).expect(409);
    await mo.post('/time-off', { startDate: '2027-01-06', endDate: '2027-01-05' }).expect(400);

    const list = (await fawad.get('/time-off').expect(200)).body as TimeOffDto[];
    expect(list.map((t) => t.user.name)).toEqual(expect.arrayContaining(['Jia Li', 'Mo Khan']));

    await mo.delete(`/time-off/${dto.id}`).expect(204);
  });

  it('owners add time off for anyone; admins set capacity, members can’t', async () => {
    const nadia = await prisma.user.findUniqueOrThrow({ where: { email: 'nadia@acme.com' } });
    const created = await fawad.post('/time-off', { userId: nadia.id, startDate: '2027-02-01', endDate: '2027-02-01' }).expect(201);
    await fawad.delete(`/time-off/${created.body.id}`).expect(204);

    await mo.patch(`/members/${nadia.id}/capacity`, { hoursPerDay: 6 }).expect(403);
    const sara = await asUser(app, 'sara@acme.com');
    await sara.patch(`/members/${nadia.id}/capacity`, { hoursPerDay: 6 }).expect(200, { userId: nadia.id, hoursPerDay: 6 });
    const w = (await fawad.get('/workload').expect(200)).body as WorkloadDto;
    expect(w.people.find((p) => p.user.id === nadia.id)!.cells[0]!.capacity).toBe(6);
    await sara.patch(`/members/${nadia.id}/capacity`, { hoursPerDay: 8 }).expect(200);
  });
});
