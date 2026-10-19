import { execSync } from 'node:child_process';
import path from 'node:path';

export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL_TEST ?? 'postgresql://hearth:hearth@localhost:5432/hearth_test';

/**
 * Runs once before the e2e suite: resets the test database to the migrations and loads the
 * demo seed so tests can sign in as the people from the designs (password hearth123).
 */
export default function setup(): void {
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { cwd, env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'inherit' });
}
