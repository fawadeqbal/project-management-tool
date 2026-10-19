import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResultDto, SearchTaskHitDto } from '@hearth/contracts';
import { signIn } from '@/test/render';
import { askHearth, hitToTask, SEARCH_DEBOUNCE_MS, useServerSearch } from './api';
import { buildPaletteGroups } from './palette-items';
import type * as HttpModule from '@/shared/api/http';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof HttpModule>();
  return { ...actual, http: { ...actual.http, get: http.get, post: http.post } };
});

const hit = (
  over: Partial<SearchTaskHitDto> & Pick<SearchTaskHitDto, 'id' | 'key' | 'title'>,
): SearchTaskHitDto => ({
  number: Number(over.key.split('-')[1]),
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueDate: null,
  hint: null,
  assignee: null,
  project: { id: 'p', name: 'Website relaunch', color: 'blue' },
  parentId: null,
  tags: [],
  updatedAt: '2026-10-19T09:00:00.000Z',
  score: 120,
  indices: [],
  ...over,
});

const result = (q: string, tasks: SearchTaskHitDto[]): SearchResultDto => ({
  query: q,
  scope: 'all',
  tasks,
  projects: [],
  people: [],
  tookMs: 7,
});

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useServerSearch', () => {
  beforeEach(() => {
    signIn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('debounces, calls GET /search with the scope and maps hits to tasks', async () => {
    http.get.mockResolvedValue(
      result('pric', [
        hit({
          id: 't188',
          key: 'HRT-188',
          title: 'Design pricing page in light and dark mode',
          hint: 'due today',
        }),
      ]),
    );
    const { result: hook, rerender } = renderHook(({ q }) => useServerSearch(q, 'tasks'), {
      wrapper: wrapper(),
      initialProps: { q: 'p' },
    });
    rerender({ q: 'pr' });
    rerender({ q: 'pric' });
    expect(http.get).not.toHaveBeenCalled();
    expect(hook.current.isFetching).toBe(true);
    await act(async () => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 5));
    await waitFor(() => expect(hook.current.tasks).toHaveLength(1));
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith(
      '/search',
      { q: 'pric', scope: 'tasks', limit: 8 },
      expect.anything(),
    );
    expect(hook.current.tasks[0]).toMatchObject({
      id: 't188',
      key: 'HRT-188',
      project: { name: 'Website relaunch' },
    });
    expect(hook.current.tookMs).toBe(7);
  });

  it('skips the server for one character and for the Commands scope', async () => {
    renderHook(() => useServerSearch('p', 'all'), { wrapper: wrapper() });
    renderHook(() => useServerSearch('pricing', 'commands'), { wrapper: wrapper() });
    await act(async () => void vi.advanceTimersByTime(500));
    expect(http.get).not.toHaveBeenCalled();
  });

  it('server results merge with local matches without duplicates', () => {
    const local = hitToTask(
      hit({ id: 't188', key: 'HRT-188', title: 'Design pricing page in light and dark mode' }),
    );
    const server = [
      hit({ id: 't188', key: 'HRT-188', title: 'Design pricing page in light and dark mode' }),
      hit({ id: 't174', key: 'HRT-174', title: 'Update pricing page comparison table' }),
    ].map(hitToTask);
    const byId = new Map([local, ...server].map((t) => [t.id, t]));
    const groups = buildPaletteGroups({
      query: 'pricing',
      scope: 'tasks',
      tasks: [...byId.values()],
      commands: [],
      members: [],
      ai: null,
    });
    expect(groups[0]!.items.map((i) => i.prefix).sort()).toEqual(['HRT-174', 'HRT-188']);
  });
});

describe('askHearth', () => {
  afterEach(() => vi.clearAllMocks());

  it('navigates with the server filter', async () => {
    http.post.mockResolvedValue({ recognized: true, href: '/my-tasks?overdue=1&team=tm-design' });
    await expect(askHearth('overdue design', '/my-tasks?overdue=1&tag=Design')).resolves.toBe(
      '/my-tasks?overdue=1&team=tm-design',
    );
    expect(http.post).toHaveBeenCalledWith('/ai/interpret', { query: 'overdue design' });
  });

  it('falls back to the local interpretation', async () => {
    http.post.mockRejectedValue(new Error('offline'));
    await expect(askHearth('overdue design', '/my-tasks?overdue=1&tag=Design')).resolves.toBe(
      '/my-tasks?overdue=1&tag=Design',
    );
  });
});
