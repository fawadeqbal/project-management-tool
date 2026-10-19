import type * as HttpModule from '@/shared/api/http';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '@/shared/api/http';
import { api } from '@/shared/api/client';
import { renderApp, signIn } from '@/test/render';
import { usePlanGateStore } from '../plan-gate';
import { backlogFixture, sprintDetail, sprintList } from '../test-fixtures';
import { burndownGeometry } from '../lib/burndown-geometry';
import { applyRank, neighboursFor } from '../lib/backlog-order';
import { SprintPage } from './SprintPage';

vi.mock('@/shared/api/client', () => ({
  api: { me: { get: vi.fn() }, workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn() }, tasks: { update: vi.fn(), list: vi.fn() } },
}));
vi.mock('@/shared/api/http', async (importOriginal) => {
  const mod = await importOriginal<typeof HttpModule>();
  return { ...mod, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const mockedHttp = vi.mocked(http, true);
const mockedApi = vi.mocked(api, true);

const limit = () =>
  new ApiError({
    status: 402,
    kind: 'limit_reached',
    code: 'plan.feature.sprints',
    message: 'Sprints is part of Business. Plan sprints, track burndown and keep velocity honest.',
    details: { feature: 'sprints', requiredPlan: 'BUSINESS' },
  });

const render = () => renderApp(<SprintPage />, { route: '/projects/p1/sprints', path: '/projects/:projectId/sprints' });

describe('SprintPage', () => {
  beforeEach(() => {
    signIn();
    usePlanGateStore.setState({ dialog: null, blocked: {} });
    mockedHttp.get.mockImplementation(async (path: string) => {
      if (path === '/projects/p1/sprints') return sprintList() as never;
      if (path === '/sprints/s24') return sprintDetail() as never;
      if (path === '/projects/p1/backlog') return backlogFixture() as never;
      return [] as never;
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the active sprint: goal, days left, tasks with points, and the over-velocity warning', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Sprint 24' })).toBeInTheDocument();
    expect(screen.getByText('Active · 3 working days left')).toBeInTheDocument();
    expect(screen.getByText(/Ship swipe actions and offline edits for beta/)).toBeInTheDocument();
    const sprintList = screen.getByRole('region', { name: 'Sprint backlog' });
    const done = within(sprintList).getByRole('button', { name: 'Swipe right to complete a task' });
    expect(done.className).toMatch(/titleDone/);
    expect(screen.getByText(/Consider moving HRT-311 back to the backlog/)).toBeInTheDocument();
    expect(screen.getByLabelText('S24: 42 points planned')).toBeInTheDocument();
  });

  it('renders the burndown with ideal and actual paths, scope change and an accessible description', async () => {
    render();
    const chart = await screen.findByRole('img', { name: /Sprint burndown/ });
    expect(chart).toHaveAccessibleName(expect.stringContaining('24 points remaining on day 6 of 9, ideal is 12.7; 4 points of scope added on day 4'));
    const ideal = within(chart as unknown as HTMLElement).getByTestId('burndown-ideal');
    const actual = within(chart as unknown as HTMLElement).getByTestId('burndown-actual');
    expect(ideal.getAttribute('points')!.split(' ')).toHaveLength(2);
    expect(actual.getAttribute('points')!.split(' ')).toHaveLength(7);
    expect(within(chart as unknown as HTMLElement).getByText('+4 pts scope')).toBeInTheDocument();
    expect(within(chart as unknown as HTMLElement).getByTestId('burndown-today')).toBeInTheDocument();
    expect(screen.getByText('9 pts behind ideal')).toBeInTheDocument();
  });

  it('ranks the backlog from the keyboard (Alt+↓) with the right neighbours', async () => {
    let ranked = false;
    mockedHttp.post.mockImplementation(async () => {
      ranked = true;
      return { taskId: 't320', backlogRank: 2.5 } as never;
    });
    const base = mockedHttp.get.getMockImplementation()!;
    mockedHttp.get.mockImplementation(async (path: string, q?: unknown) => {
      if (path === '/projects/p1/backlog' && ranked) {
        const [a, b, c] = backlogFixture();
        return [b, { ...a!, backlogRank: 2.5 }, c] as never;
      }
      return base(path, q as never);
    });
    render();
    const row = await screen.findByRole('listitem', { name: /Rank 1: HRT-320/ });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(mockedHttp.post).toHaveBeenCalledWith('/projects/p1/backlog/rank', { taskId: 't320', beforeId: 't322', afterId: 't324' }));
    const backlog = screen.getByRole('region', { name: 'Product backlog' });
    await waitFor(() => expect(within(backlog).getAllByRole('listitem')[0]).toHaveAttribute('aria-label', expect.stringMatching(/^Rank 1: HRT-322/)));
  });

  it('Shift+S adds the focused backlog row to the sprint', async () => {
    mockedHttp.post.mockResolvedValue(sprintList()[1] as never);
    render();
    const row = await screen.findByRole('listitem', { name: /Rank 2: HRT-322/ });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'S', shiftKey: true });
    await waitFor(() => expect(mockedHttp.post).toHaveBeenCalledWith('/sprints/s24/tasks', { taskId: 't322' }));
    expect(await screen.findByText('HRT-322 added to Sprint 24')).toBeInTheDocument();
  });

  it('turns a 402 into an upgrade dialog with See plans / Not now, then a calm banner', async () => {
    mockedHttp.post.mockRejectedValue(limit());
    const { router } = render();
    fireEvent.click(await screen.findByRole('button', { name: 'Complete sprint' }));
    const confirm = await screen.findByRole('dialog', { name: 'Complete Sprint 24?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Complete sprint' }));

    const upgrade = await screen.findByRole('dialog', { name: 'Upgrade to keep going' });
    expect(upgrade).toHaveTextContent('Sprints is part of Business. Plan sprints, track burndown and keep velocity honest.');
    expect(within(upgrade).getByRole('button', { name: 'See plans' })).toBeInTheDocument();
    fireEvent.click(within(upgrade).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Upgrade to keep going' })).toBeNull());
    expect(screen.getByText(/Sprint planning is part of Business/).closest('[role="status"]')).toBeInTheDocument();

    // See plans navigates to billing.
    act(() => usePlanGateStore.getState().open('Sprints is part of Business.', 'sprints'));
    fireEvent.click(await screen.findByRole('button', { name: 'See plans' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/billing'));
  });

  it('Space on a sprint row toggles done through the task mutations', async () => {
    mockedApi.tasks.update.mockResolvedValue({} as never);
    render();
    const row = await screen.findByRole('listitem', { name: /HRT-311 Background refresh/ });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: ' ' });
    await waitFor(() => expect(mockedApi.tasks.update).toHaveBeenCalledWith('t311', { status: 'DONE' }));
  });
});

describe('sprint helpers', () => {
  it('computes burndown geometry within the frame', () => {
    const g = burndownGeometry(sprintDetail().burndown);
    expect(g.max).toBe(50);
    expect(g.x(0)).toBe(32);
    expect(g.x(9)).toBe(392);
    expect(g.y(0)).toBe(192);
    expect(g.scope).toHaveLength(1);
  });

  it('finds neighbours and reorders optimistically', () => {
    const items = backlogFixture();
    expect(neighboursFor(items, 2, 0)).toEqual({ beforeId: null, afterId: 't320' });
    const next = applyRank(items, { taskId: 't324', beforeId: null, afterId: 't320' });
    expect(next.map((t) => t.key)).toEqual(['HRT-324', 'HRT-320', 'HRT-322']);
  });
});
