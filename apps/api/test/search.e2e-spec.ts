import type { INestApplication } from '@nestjs/common';
import type { SearchResultDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';

describe('Search (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let tom: UserClient;

  beforeAll(async () => {
    app = await createTestApp();
    [fawad, tom] = await Promise.all([asUser(app), asUser(app, 'tom@northwind.co')]);
  });
  afterAll(async () => {
    await app.close();
  });

  const search = async (who: UserClient, query: string) => (await who.get(`/search?${query}`).expect(200)).body as SearchResultDto;

  it('ranks "pric" with HRT-188 first and returns grouped results with timing', async () => {
    const res = await search(fawad, 'q=pric');
    expect(res.tasks[0]).toMatchObject({ key: 'HRT-188', title: 'Design pricing page in light and dark mode', status: 'IN_PROGRESS' });
    expect(res.tasks[0]!.indices.length).toBe(4);
    expect(res.tasks.length).toBeLessThanOrEqual(8);
    expect(typeof res.tookMs).toBe('number');
    expect(res).toHaveProperty('projects');
    expect(res).toHaveProperty('people');
  });

  it('adds due hints and finds by key', async () => {
    const res = await search(fawad, 'q=HRT-118&scope=tasks');
    expect(res.tasks[0]).toMatchObject({ key: 'HRT-118', hint: 'overdue 2 days' });
    expect(res.projects).toEqual([]);
    const today = await search(fawad, 'q=onboarding checklist');
    expect(today.tasks[0]).toMatchObject({ key: 'HRT-142', hint: 'due today' });
  });

  it('finds projects and people', async () => {
    const res = await search(fawad, 'q=web');
    expect(res.projects[0]).toMatchObject({ name: 'Website relaunch' });
    const people = await search(fawad, 'q=sara&scope=people');
    expect(people.people[0]).toMatchObject({ name: 'Sara Ahmed', email: 'sara@acme.com' });
    expect(people.tasks).toEqual([]);
  });

  it('keeps guests inside their projects', async () => {
    const res = await search(tom, 'q=a&limit=50');
    expect(res.tasks.length).toBeGreaterThan(0);
    expect(res.tasks.every((t) => t.project?.name === 'Website relaunch')).toBe(true);
    expect(res.projects.every((p) => p.name === 'Website relaunch')).toBe(true);
    expect(res.people).toEqual([]);
    const mobile = await search(tom, 'q=swipe');
    expect(mobile.tasks).toEqual([]);
  });

  it('returns nothing for an empty query', async () => {
    const res = await search(fawad, 'q=');
    expect(res.tasks).toEqual([]);
  });
});
