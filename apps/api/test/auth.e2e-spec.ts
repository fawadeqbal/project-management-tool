import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { api, asUser, createTestApp } from './utils';

describe('Identity & workspace (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a token', async () => {
    const res = await request(app.getHttpServer()).get(api('/me')).expect(401);
    expect(res.body.error.kind).toBe('unauthorized');
  });

  it('registers a person with their own workspace', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({
        name: 'Lena Park',
        email: 'lena@example.com',
        password: 'longenough',
        workspaceName: 'Northwind Labs',
      })
      .expect(201);
    expect(res.body.me.workspace).toMatchObject({ name: 'Northwind Labs', keyPrefix: 'NL', role: 'OWNER' });
    expect(res.body.me.permissions).toContain('billing.manage');
  });

  it('returns a validation envelope with field errors', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({ name: '', email: 'nope', password: 'x' })
      .expect(400);
    expect(res.body.error.kind).toBe('validation');
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('does not reveal whether an email exists', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: 'fawad@acme.com', password: 'wrong' })
      .expect(401);
    expect(res.body.error.message).toMatch(/don’t match/);
  });

  it('signs in a seeded user and returns their workspace, people and shell', async () => {
    const fawad = await asUser(app);
    const me = await fawad.get('/me').expect(200);
    expect(me.body.workspace).toMatchObject({ name: 'Acme Studio', keyPrefix: 'HRT', role: 'OWNER' });

    const members = await fawad.get('/members').expect(200);
    expect(members.body.map((m: { name: string }) => m.name)).toEqual(
      expect.arrayContaining(['Sara Ahmed', 'Mo Khan']),
    );

    const shell = await fawad.get('/shell').expect(200);
    expect(shell.body.favorites.map((p: { name: string }) => p.name)).toContain('Website relaunch');
    expect(shell.body.counts.myTasks).toBeGreaterThan(0);
  });

  it('keeps deactivated members out', async () => {
    await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: 'priya@acme.com', password: 'hearth123' })
      .expect(401);
  });
});
