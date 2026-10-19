import type { INestApplication } from '@nestjs/common';
import { asUser, createTestApp, type UserClient } from './utils';

describe('Billing (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  beforeAll(async () => {
    app = await createTestApp();
    fawad = await asUser(app);
    await fawad.post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY', confirm: true });
    await fawad.post('/billing/resume');
  });
  afterAll(async () => {
    await fawad.post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY', confirm: true });
    await app.close();
  });

  it('shows the current plan, usage meters with pacing and the plan catalog', async () => {
    const { body } = await fawad.get('/billing').expect(200);
    expect(body.current).toMatchObject({
      plan: 'PRO',
      planName: 'Pro',
      interval: 'MONTHLY',
      status: 'ACTIVE',
      seats: 10,
    });
    const meters = Object.fromEntries(body.usage.map((u: { meter: string }) => [u.meter, u]));
    expect(meters.automation_runs).toMatchObject({
      used: 940,
      limit: 1000,
      usedLabel: '940',
      limitLabel: '1,000',
    });
    expect(meters.ai_credits).toMatchObject({ used: 420, limit: 500 });
    expect(meters.storage_bytes.usedLabel).toBe('18 GB');
    expect(meters.seats.limit).toBe(10);
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);
    const business = body.plans.find((p: { id: string }) => p.id === 'BUSINESS');
    expect(business).toMatchObject({
      isRecommended: true,
      action: 'upgrade',
      priceLabel: { MONTHLY: '$20', ANNUAL: '$16' },
    });
    expect(business.annualSavings.label).toMatch(/^Save \$[\d,]+ a year$/);
    expect(body.plans.find((p: { id: string }) => p.id === 'PRO').isCurrent).toBe(true);
    expect(body.plans.find((p: { id: string }) => p.id === 'FREE')).toMatchObject({ action: 'downgrade' });
    expect(body.plans.find((p: { id: string }) => p.id === 'ENTERPRISE')).toMatchObject({
      action: 'contact',
    });
    expect(body.recommendedPlan).toBe('BUSINESS');
  });

  it('describes a locked feature for the upgrade prompt', async () => {
    const { body } = await fawad.get('/billing/limits/sprints').expect(200);
    expect(body).toMatchObject({
      allowed: false,
      requiredPlan: 'BUSINESS',
      featureName: 'Sprints',
      currentPlan: 'PRO',
    });
    expect((await fawad.get('/billing/limits/timeline').expect(200)).body.allowed).toBe(true);
    await fawad.get('/billing/limits/teleport').expect(400);
  });

  it('only lets owners change the plan', async () => {
    const sara = await asUser(app, 'sara@acme.com');
    await sara.get('/billing').expect(200);
    await sara.post('/billing/plan', { plan: 'BUSINESS', interval: 'MONTHLY' }).expect(403);
  });

  it('upgrades to Business, after which saving the dashboard layout works', async () => {
    await fawad.patch('/dashboard/layout', { widgets: ['project-health', 'kpis'] }).expect(402);
    const res = await fawad.post('/billing/plan', { plan: 'BUSINESS', interval: 'ANNUAL' }).expect(200);
    expect(res.body.billing.current).toMatchObject({ plan: 'BUSINESS', interval: 'ANNUAL' });
    const layout = await fawad
      .patch('/dashboard/layout', { widgets: ['project-health', 'kpis'] })
      .expect(200);
    expect(layout.body.layout).toEqual(['project-health', 'kpis', 'throughput', 'status-mix']);
    expect((await fawad.get('/dashboard').expect(200)).body.layout[0]).toBe('project-health');
    await fawad.post('/dashboard/schedule', { cadence: 'weekly', recipients: ['sara@acme.com'] }).expect(201);
  });

  it('asks to confirm a downgrade that loses features, listing them', async () => {
    const res = await fawad.post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY' }).expect(409);
    expect(res.body.error.code).toBe('billing.confirm_downgrade');
    expect(res.body.error.details.lostFeatureNames).toEqual(
      expect.arrayContaining(['Sprints', 'Dashboards']),
    );
    const ok = await fawad
      .post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY', confirm: true })
      .expect(200);
    expect(ok.body.lostFeatures).toContain('dashboards');
  });

  it('refuses Free when the team does not fit', async () => {
    const res = await fawad
      .post('/billing/plan', { plan: 'FREE', interval: 'MONTHLY', confirm: true })
      .expect(409);
    expect(res.body.error.message).toMatch(/allows 5 people/);
  });

  it('pauses, resumes and cancels at period end (still reachable)', async () => {
    await fawad.post('/billing/pause', { months: 4 }).expect(400);
    expect((await fawad.post('/billing/pause', { months: 2 }).expect(200)).body.current.status).toBe(
      'PAUSED',
    );
    expect((await fawad.post('/billing/resume').expect(200)).body.current.status).toBe('ACTIVE');
    await fawad.post('/billing/cancel', {}).expect(400);
    expect((await fawad.post('/billing/cancel', { confirm: true }).expect(200)).body.current.status).toBe(
      'CANCELED',
    );
    expect((await fawad.get('/billing').expect(200)).body.current.status).toBe('CANCELED');
    await fawad.post('/billing/resume').expect(200);
  });

  it('exports the workspace as a JSON attachment', async () => {
    const res = await fawad.get('/billing/export').expect(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="acme-studio-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.body.workspace.name).toBe('Acme Studio');
    expect(res.body.projects.length).toBeGreaterThanOrEqual(3);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(95);
    expect(res.body.tasks[0].key).toMatch(/^HRT-\d+$/);
  });
});
