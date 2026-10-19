import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { api, asUser, createTestApp, type UserClient } from './utils';

describe('Members & roles (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let sara: UserClient;
  let ids: Record<string, string>;
  let webProjectId: string;
  beforeAll(async () => {
    app = await createTestApp();
    fawad = await asUser(app);
    sara = await asUser(app, 'sara@acme.com');
    await fawad.post('/billing/plan', { plan: 'PRO', interval: 'MONTHLY', confirm: true });
    const { body } = await fawad.get('/admin/members').expect(200);
    ids = Object.fromEntries(body.members.map((m: { email: string; id: string }) => [m.email.split('@')[0], m.id]));
    const dash = await fawad.get('/dashboard').expect(200);
    webProjectId = dash.body.projects.find((p: { project: { name: string } }) => p.project.name === 'Website relaunch').project.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists members with roles, teams, last active, guests and the SSO/SCIM status', async () => {
    const { body } = await fawad.get('/admin/members').expect(200);
    const byEmail = Object.fromEntries(body.members.map((m: { email: string }) => [m.email, m]));
    expect(byEmail['fawad@acme.com']).toMatchObject({ role: 'OWNER', lastActiveLabel: 'Now', isYou: true, teams: [{ name: 'Product' }] });
    expect(byEmail['sara@acme.com']).toMatchObject({ role: 'ADMIN', teams: [{ name: 'Design' }] });
    expect(byEmail['tom@northwind.co']).toMatchObject({ role: 'GUEST', isGuest: true, guestProjectCount: 1 });
    expect(byEmail['priya@acme.com']).toMatchObject({ status: 'DEACTIVATED' });
    // Guests after members, deactivated last.
    expect(body.members.at(-1).email).toBe('priya@acme.com');
    expect(body.counts).toMatchObject({ members: 6, guests: 1, deactivated: 1, pendingInvites: 3, seatLimit: 10 });
    expect(body.identity.summary).toBe('SSO: not configured · SCIM: available on Enterprise');
  });

  it('lists pending invites with plain-words meta', async () => {
    const { body } = await fawad.get('/admin/invites').expect(200);
    const metas = Object.fromEntries(body.map((i: { email: string; meta: string }) => [i.email, i.meta]));
    expect(metas).toMatchObject({
      'lena@acme.com': 'Member · Design · sent 2 days ago',
      'omar@acme.com': 'Member · Engineering · sent 5 days ago',
      'kate@northwind.co': 'Guest · Website relaunch · expires in 2 days',
    });
  });

  it('returns role descriptions and the permission matrix', async () => {
    const { body } = await fawad.get('/admin/roles').expect(200);
    expect(body.roles.map((r: { label: string }) => r.label)).toEqual(['Owner', 'Admin', 'Member', 'Viewer', 'Guest']);
    expect(body.matrix.find((r: { permission: string }) => r.permission === 'billing.manage').roles).toEqual(['OWNER']);
  });

  it('requires a project for guest invites', async () => {
    const res = await sara.post('/admin/invites', { email: 'client@example.com', role: 'GUEST' }).expect(400);
    expect(res.body.error.fieldErrors.projectId).toBeDefined();
    await sara.post('/admin/invites', { email: 'client@example.com', role: 'GUEST', projectId: webProjectId }).expect(201);
  });

  it('enforces the seat limit with 402 once Pro’s 10 seats are committed', async () => {
    // 6 active members + 2 pending member invites = 8 committed seats.
    await sara.post('/admin/invites', { email: 'nine@acme.com', role: 'MEMBER' }).expect(201);
    await sara.post('/admin/invites', { email: 'ten@acme.com', role: 'VIEWER' }).expect(201);
    const res = await sara.post('/admin/invites', { email: 'eleven@acme.com', role: 'MEMBER' }).expect(402);
    expect(res.body.error).toMatchObject({ kind: 'limit_reached', code: 'plan.limit.seats', details: { limit: 10 } });
    // Guests don't take seats.
    await sara.post('/admin/invites', { email: 'guest2@example.com', role: 'GUEST', projectId: webProjectId }).expect(201);
  });

  it('resends and revokes invites, which frees the seat', async () => {
    const { body } = await sara.get('/admin/invites').expect(200);
    const ten = body.find((i: { email: string }) => i.email === 'ten@acme.com');
    const resent = await sara.post(`/admin/invites/${ten.id}/resend`).expect(200);
    expect(resent.body.meta).toBe('Viewer · sent today');
    await sara.delete(`/admin/invites/${ten.id}`).expect(204);
    await sara.post('/admin/invites', { email: 'eleven@acme.com', role: 'MEMBER' }).expect(201);
  });

  it('lets a new person accept an invite and join with the invited role', async () => {
    const invited = await sara.post('/admin/invites', { email: 'gina@example.com', role: 'GUEST', projectId: webProjectId }).expect(201);
    const reg = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({ name: 'Gina Park', email: 'gina@example.com', password: 'longenough' })
      .expect(201);
    const token = reg.body.accessToken as string;
    const accept = await request(app.getHttpServer()).post(api(`/invites/${invited.body.token}/accept`)).set('Authorization', `Bearer ${token}`).expect(200);
    expect(accept.body).toMatchObject({ role: 'GUEST', projectId: webProjectId });
    await request(app.getHttpServer()).post(api(`/invites/${invited.body.token}/accept`)).set('Authorization', `Bearer ${token}`).expect(409);
    const { body } = await fawad.get('/admin/members').expect(200);
    expect(body.members.find((m: { email: string }) => m.email === 'gina@example.com')).toMatchObject({ role: 'GUEST', guestProjectCount: 1 });
  });

  it('blocks role escalation (403) and protects the last owner (409)', async () => {
    const esc = await sara.patch(`/admin/members/${ids.mo}/role`, { role: 'OWNER' }).expect(403);
    expect(esc.body.error.code).toBe('roles.escalation');
    const last = await fawad.patch(`/admin/members/${ids.fawad}/role`, { role: 'ADMIN' }).expect(409);
    expect(last.body.error.code).toBe('members.last_owner');
    await sara.patch(`/admin/members/${ids.sara}/role`, { role: 'MEMBER' }).expect(403);
    await sara.patch(`/admin/members/${ids.mo}/role`, { role: 'VIEWER' }).expect(200);
    const res = await fawad.patch(`/admin/members/${ids.mo}/role`, { role: 'MEMBER' }).expect(200);
    expect(res.body).toEqual({ userId: ids.mo, role: 'MEMBER' });
  });

  it('deactivates and reactivates reversibly, never yourself or the last owner', async () => {
    await sara.post(`/admin/members/${ids.sara}/deactivate`).expect(403);
    await sara.post(`/admin/members/${ids.fawad}/deactivate`).expect(409);
    await sara.post(`/admin/members/${ids.ravi}/deactivate`).expect(200);
    await request(app.getHttpServer()).post(api('/auth/login')).send({ email: 'ravi@acme.com', password: 'hearth123' }).expect(401);
    const back = await sara.post(`/admin/members/${ids.ravi}/reactivate`).expect(200);
    expect(back.body.status).toBe('ACTIVE');
    await asUser(app, 'ravi@acme.com');
  });

  it('does not let members manage people', async () => {
    const mo = await asUser(app, 'mo@acme.com');
    await mo.post('/admin/invites', { email: 'x@acme.com', role: 'MEMBER' }).expect(403);
    await mo.get('/admin/members').expect(200);
  });

  it('removes permanently only with confirm, unassigning open tasks', async () => {
    await fawad.delete(`/admin/members/${ids.priya}`).expect(400);
    const res = await fawad.delete(`/admin/members/${ids.priya}`).send({ confirm: true }).expect(200);
    expect(res.body.userId).toBe(ids.priya);
    const { body } = await fawad.get('/admin/members').expect(200);
    expect(body.members.find((m: { email: string }) => m.email === 'priya@acme.com')).toBeUndefined();
  });
});
