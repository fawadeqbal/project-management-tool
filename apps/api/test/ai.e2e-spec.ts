import type { INestApplication } from '@nestjs/common';
import type { AcceptSuggestionResultDto, AiSuggestionDto, InterpretResultDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';

describe('AI assist (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let task188: { id: string; description: string | null };

  beforeAll(async () => {
    delete process.env.ANTHROPIC_API_KEY; // deterministic local provider
    app = await createTestApp();
    fawad = await asUser(app);
    task188 = (await fawad.get('/tasks/key/HRT-188').expect(200)).body;
  });
  afterAll(async () => {
    await app.close();
  });

  it('generates a labelled summary suggestion and accepting appends it to the description', async () => {
    const s = (await fawad.post(`/tasks/${task188.id}/ai/summary`).expect(201)).body as AiSuggestionDto;
    expect(s).toMatchObject({ kind: 'summary', status: 'PENDING', taskId: task188.id });
    expect(s.source).toMatch(/^generated from \d+ comments$/);
    expect(s.summary!.text).toContain('(HRT-182)');
    expect(s.summary!.text).toContain('Suggested next step:');

    const pending = (await fawad.get(`/tasks/${task188.id}/ai/suggestions`).expect(200)).body as AiSuggestionDto[];
    expect(pending.map((p) => p.id)).toEqual([s.id]);

    // Nothing is written before the click.
    expect((await fawad.get(`/tasks/${task188.id}`).expect(200)).body.description).toBe(task188.description);

    const res = (await fawad.post(`/ai/suggestions/${s.id}/accept`, { edited: { text: 'Light mode is approved. Blocked on HRT-182.' } }).expect(200)).body as AcceptSuggestionResultDto;
    expect(res.suggestion.status).toBe('ACCEPTED');
    expect(res.description).toBe(`${task188.description}\n\nSummary: Light mode is approved. Blocked on HRT-182.`);
    expect((await fawad.get(`/tasks/${task188.id}`).expect(200)).body.description).toBe(res.description);
    await fawad.post(`/ai/suggestions/${s.id}/accept`).expect(422);
    expect((await fawad.get(`/tasks/${task188.id}/ai/suggestions`).expect(200)).body).toEqual([]);
  });

  it('discards a suggestion without touching the task', async () => {
    const s = (await fawad.post(`/tasks/${task188.id}/ai/summary`).expect(201)).body as AiSuggestionDto;
    const res = await fawad.post(`/ai/suggestions/${s.id}/discard`).expect(200);
    expect(res.body.status).toBe('DISCARDED');
  });

  it('breaks a task down and accepting creates subtasks with keys', async () => {
    const parent = (await fawad.get('/tasks/key/HRT-218').expect(200)).body as { id: string; subtasks: unknown[] };
    const s = (await fawad.post(`/tasks/${parent.id}/ai/breakdown`).expect(201)).body as AiSuggestionDto;
    expect(s.kind).toBe('breakdown');
    expect(s.breakdown!.subtasks.length).toBeGreaterThanOrEqual(3);
    expect(s.breakdown!.subtasks.length).toBeLessThanOrEqual(6);

    const chosen = s.breakdown!.subtasks.slice(0, 2);
    const res = (await fawad.post(`/ai/suggestions/${s.id}/accept`, { edited: { subtasks: chosen } }).expect(200)).body as AcceptSuggestionResultDto;
    expect(res.createdSubtasks!.map((c) => c.title)).toEqual(chosen);
    const [a, b] = res.createdSubtasks!;
    expect(a!.key).toMatch(/^HRT-\d+$/);
    expect(Number(b!.key.split('-')[1])).toBe(Number(a!.key.split('-')[1]) + 1);

    const detail = (await fawad.get(`/tasks/${parent.id}`).expect(200)).body as { subtasks: { key: string; title: string }[] };
    expect(detail.subtasks.map((x) => x.key)).toEqual(expect.arrayContaining([a!.key, b!.key]));
    // The next normal task gets the following number.
    const next = (await fawad.post('/tasks', { title: 'After breakdown' }).expect(201)).body as { number: number };
    expect(next.number).toBe(Number(b!.key.split('-')[1]) + 1);
  });

  it('interprets "overdue design" into a My tasks filter', async () => {
    const res = (await fawad.post('/ai/interpret', { query: 'overdue design' }).expect(200)).body as InterpretResultDto;
    expect(res.recognized).toBe(true);
    expect(res.filter.overdue).toBe(true);
    expect(res.explanation).toBe('Show overdue tasks for the Design team');
    expect(res.params.overdue).toBe('1');
    expect(res.params.team).toBeTruthy();
    expect(res.href).toMatch(/^\/my-tasks\?overdue=1&team=/);

    const plain = (await fawad.post('/ai/interpret', { query: 'zebra' }).expect(200)).body as InterpretResultDto;
    expect(plain.recognized).toBe(false);
    await fawad.post('/ai/interpret', { query: '' }).expect(400);
  });
});
