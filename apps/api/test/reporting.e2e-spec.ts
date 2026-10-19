import type { INestApplication } from '@nestjs/common';
import { asUser, createTestApp, type UserClient } from './utils';

describe('Reporting (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  beforeAll(async () => {
    app = await createTestApp();
    fawad = await asUser(app);
    await fawad.post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY', confirm: true });
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns KPI tiles, weekly throughput, status mix and project health', async () => {
    const res = await fawad.get('/dashboard?range=6w').expect(200);
    const body = res.body;
    expect(body.kpis.map((k: { label: string }) => k.label)).toEqual([
      'Tasks completed',
      'On-time delivery',
      'Avg. cycle time',
      'Overdue now',
    ]);
    for (const k of body.kpis) {
      expect(['good', 'bad', 'neutral']).toContain(k.deltaTone);
      expect(typeof k.sub).toBe('string');
    }
    expect(body.kpis[3].value).toBe('9');
    expect(body.throughput).toHaveLength(6);
    expect(body.throughputVerdict.text).toMatch(/^Completed ≥ created for \d of 6 weeks$/);
    expect(body.statusMix.map((s: { status: string }) => s.status)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'IN_REVIEW',
      'BLOCKED',
    ]);
    expect([...body.layout].sort()).toEqual(['kpis', 'project-health', 'status-mix', 'throughput']);
    expect(Date.parse(body.generatedAt)).not.toBeNaN();

    const names = body.projects.map((p: { project: { name: string } }) => p.project.name);
    expect(names).toEqual(expect.arrayContaining(['Website relaunch', 'Q4 brand campaign', 'Mobile app v2']));
    const mobile = body.projects.find(
      (p: { project: { name: string } }) => p.project.name === 'Mobile app v2',
    );
    expect(mobile).toMatchObject({
      health: 'OFF_TRACK',
      healthMeta: { label: 'Off track', tone: 'danger' },
      owner: { initials: 'MK' },
      budgetUsedPct: 93,
      budgetTone: 'danger',
    });
    expect(mobile.progress).toBeGreaterThanOrEqual(0);
    expect(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).toContain(mobile.suggestedHealth);
  });

  it('supports the 2-week and quarter ranges and validates the range', async () => {
    expect((await fawad.get('/dashboard?range=2w').expect(200)).body.throughput).toHaveLength(2);
    expect((await fawad.get('/dashboard?range=q').expect(200)).body.throughput).toHaveLength(13);
    await fawad.get('/dashboard?range=year').expect(400);
  });

  it('keeps the dashboard previewable on Pro but gates layout and schedule writes (402)', async () => {
    const layout = await fawad
      .patch('/dashboard/layout', { widgets: ['project-health', 'kpis'] })
      .expect(402);
    expect(layout.body.error).toMatchObject({
      kind: 'limit_reached',
      details: { feature: 'dashboards', requiredPlan: 'BUSINESS' },
    });
    await fawad.post('/dashboard/schedule', { recipients: ['sara@acme.com'] }).expect(402);
  });

  it('keeps guests out of the portfolio dashboard', async () => {
    const tom = await asUser(app, 'tom@northwind.co');
    await tom.get('/dashboard').expect(403);
  });
});
