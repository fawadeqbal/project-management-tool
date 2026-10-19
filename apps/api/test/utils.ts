import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_DATABASE_URL } from './global-setup';

/**
 * Boots the real AppModule with the production HTTP configuration against the test database.
 * Env is set before the app module is imported so Prisma and JWT pick it up.
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET ??= 'e2e-secret-0123456789abcdef0123456789';
  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/app.setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

export const api = (path: string) => `/api/v1${path}`;

/** Signs in as a seeded user (password hearth123) and returns a bearer token. */
export async function login(
  app: INestApplication,
  email = 'fawad@acme.com',
  password = 'hearth123',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(api('/auth/login'))
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

/** A supertest client bound to a user: `const fawad = await asUser(app); await fawad.get('/tasks')`. */
export async function asUser(app: INestApplication, email?: string) {
  const token = await login(app, email);
  const server = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    token,
    get: (p: string) => auth(request(server).get(api(p))),
    post: (p: string, body?: object) => auth(request(server).post(api(p))).send(body ?? {}),
    patch: (p: string, body?: object) => auth(request(server).patch(api(p))).send(body ?? {}),
    put: (p: string, body?: object) => auth(request(server).put(api(p))).send(body ?? {}),
    delete: (p: string) => auth(request(server).delete(api(p))),
  };
}

export type UserClient = Awaited<ReturnType<typeof asUser>>;
