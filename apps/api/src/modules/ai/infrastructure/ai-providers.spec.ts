import { describe, expect, it, vi } from 'vitest';
import type { AiTaskContext } from '@hearth/domain';
import { LocalHeuristicAiProvider } from './local-heuristic-ai.provider';
import { AnthropicAiProvider } from './anthropic-ai.provider';
import { FallbackAiProvider } from './fallback-ai.provider';
import { selectAiProvider } from './ai-provider.factory';

const ctx: AiTaskContext = {
  key: 'HRT-188',
  title: 'Design pricing page in light and dark mode',
  description: null,
  status: 'IN_PROGRESS',
  dueDate: '2026-10-19',
  today: '2026-10-19',
  blockedBy: [{ key: 'HRT-182', title: 'Final plan names from Marketing', status: 'IN_PROGRESS' }],
  subtasks: [
    { title: 'Light mode comps', done: true },
    { title: 'Dark mode contrast fixes', done: false },
  ],
  comments: Array.from({ length: 12 }, (_, i) => ({ author: 'Sara Ahmed', body: `Comment ${i + 1}`, createdAt: `2026-10-19T0${Math.min(9, i)}:00:00Z` })),
};

describe('AI providers', () => {
  it('local heuristic output is deterministic and names its source', async () => {
    const local = new LocalHeuristicAiProvider();
    const a = await local.summarizeTask(ctx);
    expect(await local.summarizeTask(ctx)).toEqual(a);
    expect(a.source).toBe('generated from 12 comments');
    expect(a.text).toContain('Blocked until “Final plan names from Marketing” (HRT-182) is done.');
    expect(a.text).toMatch(/Suggested next step: /);
    const b = await local.breakDownTask({ ...ctx, subtasks: [] });
    expect(b.subtasks.length).toBeGreaterThanOrEqual(3);
    expect(b.subtasks.length).toBeLessThanOrEqual(6);
    expect(await local.breakDownTask({ ...ctx, subtasks: [] })).toEqual(b);
  });

  it('selects Anthropic only when a key is set', () => {
    expect(selectAiProvider({}).name).toBe('local');
    expect(selectAiProvider({ apiKey: 'sk-test' }).name).toBe('anthropic+local');
  });

  it('calls the Messages API and parses JSON output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{"summary":"Light mode is approved.","nextStep":"Ship light mode behind a flag"}' }] }),
    });
    const p = new AnthropicAiProvider({ apiKey: 'k', model: 'claude-haiku-4-5' }, fetchImpl);
    const s = await p.summarizeTask(ctx);
    expect(s.text).toBe('Light mode is approved. Suggested next step: ship light mode behind a flag.');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('k');
    expect(JSON.parse(init.body).model).toBe('claude-haiku-4-5');
  });

  it('falls back to local on any error', async () => {
    const failing = new AnthropicAiProvider({ apiKey: 'k', model: 'm' }, vi.fn().mockResolvedValue({ ok: false, status: 529, json: async () => ({}) }));
    const p = new FallbackAiProvider(failing, new LocalHeuristicAiProvider());
    const s = await p.summarizeTask(ctx);
    expect(s.source).toBe('generated from 12 comments');
    expect((await p.breakDownTask(ctx)).subtasks.length).toBeGreaterThanOrEqual(3);
  });
});
