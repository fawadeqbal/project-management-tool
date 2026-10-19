import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toDateOnly, addDays } from '@hearth/domain';
import { api } from '@/shared/api/client';
import { today } from '@/shared/tasks/dates';
import { makeTask, renderApp, signIn } from '@/test/render';
import { MyTasksPage, summaryLine } from './MyTasksPage';

vi.mock('@/shared/api/client', () => ({
  api: {
    me: { get: vi.fn(), update: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn(), createTag: vi.fn() },
    tasks: {
      list: vi.fn(),
      update: vi.fn(),
      quickAdd: vi.fn(),
      create: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

const mocked = vi.mocked(api, true);
const t0 = today();
const iso = (days: number) => toDateOnly(addDays(t0, days));

const tasks = [
  makeTask({
    id: 'a',
    key: 'HRT-142',
    title: 'Write onboarding checklist copy',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dueDate: iso(0),
  }),
  makeTask({
    id: 'b',
    key: 'HRT-118',
    title: 'Review Q3 analytics dashboard',
    priority: 'URGENT',
    status: 'IN_REVIEW',
    dueDate: iso(-2),
  }),
  makeTask({
    id: 'c',
    key: 'HRT-160',
    title: 'Draft sprint 24 retrospective agenda',
    priority: 'LOW',
    dueDate: iso(1),
  }),
  makeTask({
    id: 'd',
    key: 'HRT-300',
    title: 'Plan next quarter offsite',
    priority: 'LOW',
    dueDate: iso(30),
  }),
];

describe('MyTasksPage', () => {
  beforeEach(() => {
    signIn();
    mocked.me.get.mockResolvedValue(undefined as never);
    mocked.workspace.shell.mockResolvedValue({
      favorites: [],
      teams: [],
      counts: { myTasks: 4, inbox: 0 },
      onboarding: { completed: 5, total: 5, nextStep: null },
    });
    mocked.workspace.members.mockResolvedValue([]);
    mocked.workspace.teams.mockResolvedValue([]);
    mocked.workspace.tags.mockResolvedValue([]);
    mocked.tasks.list.mockResolvedValue(tasks);
  });
  afterEach(() => vi.clearAllMocks());

  it('renders due-date groups with Overdue first and Later collapsed', async () => {
    const { unmount } = renderApp(<MyTasksPage />, { route: '/my-tasks' });
    await screen.findByText('Review Q3 analytics dashboard');

    const headers = screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(headers[0]).toMatch(/^Overdue1$/);
    expect(headers[1]).toMatch(/^Today1$/);
    expect(headers[2]).toMatch(/^Upcoming1$/);
    expect(headers[3]).toMatch(/^Later1$/);

    // Later is collapsed by default: its task isn't rendered until expanded.
    expect(screen.queryByText('Plan next quarter offsite')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Later/ }));
    expect(screen.getByText('Plan next quarter offsite')).toBeInTheDocument();

    // Overdue dates are humanized and red.
    const overdueRow = screen.getByRole('row', { name: /HRT-118/ });
    expect(within(overdueRow).getByText('2 days ago')).toBeInTheDocument();
    unmount();
  });

  it('greets by first name and summarizes the day with domain rules', async () => {
    const { unmount } = renderApp(<MyTasksPage />, { route: '/my-tasks' });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/, Fawad$/);
    await screen.findByText(/1 task due today · 1 overdue/);
    unmount();
  });

  it('Space completes the focused row optimistically and offers Undo', async () => {
    let resolveUpdate: (v: unknown) => void = () => undefined;
    mocked.tasks.update.mockImplementation(() => new Promise((r) => (resolveUpdate = r)) as never);
    const { unmount } = renderApp(<MyTasksPage />, { route: '/my-tasks' });
    await screen.findByText('Review Q3 analytics dashboard');

    // J focuses the first visible row (the overdue one).
    act(() => {
      fireEvent.keyDown(document.body, { key: 'j' });
    });
    const row = screen.getByRole('row', { name: /HRT-118/ });
    expect(row).toHaveFocus();

    act(() => {
      fireEvent.keyDown(row, { key: ' ' });
    });

    // Optimistic: the row shows as done before the server answers.
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /HRT-118/ })).getByRole('checkbox')).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(mocked.tasks.update).toHaveBeenCalledWith('b', { status: 'DONE' });
    expect(screen.getByText('HRT-118 marked as done')).toBeInTheDocument();

    // Undo reopens with the previous status.
    mocked.tasks.update.mockResolvedValue({ ...tasks[1]!, status: 'IN_REVIEW' } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenLastCalledWith('b', { status: 'IN_REVIEW' }));
    resolveUpdate({ ...tasks[1]!, status: 'DONE' });
    unmount();
  });

  it('shows the empty state when nothing is assigned', async () => {
    mocked.tasks.list.mockResolvedValue([]);
    const { unmount } = renderApp(<MyTasksPage />, { route: '/my-tasks' });
    expect(await screen.findByText('Nothing on your plate yet')).toBeInTheDocument();
    unmount();
  });

  it('reads Ask Hearth filters from the URL', async () => {
    const { unmount } = renderApp(<MyTasksPage />, { route: '/my-tasks?overdue=1' });
    await screen.findByText('Review Q3 analytics dashboard');
    expect(screen.queryByText('Write onboarding checklist copy')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search filters' })).toBeInTheDocument();
    unmount();
  });
});

describe('summaryLine', () => {
  it('counts due today and overdue', () => {
    const now = new Date(2026, 9, 19, 9);
    const list = [
      makeTask({ id: '1', key: 'HRT-1', title: 'a', dueDate: '2026-10-19' }),
      makeTask({ id: '2', key: 'HRT-2', title: 'b', dueDate: '2026-10-19' }),
      makeTask({ id: '3', key: 'HRT-3', title: 'c', dueDate: '2026-10-17' }),
      makeTask({ id: '4', key: 'HRT-4', title: 'd', dueDate: '2026-10-17', status: 'DONE' }),
    ];
    expect(summaryLine(list, now)).toBe('Monday, October 19 · 2 tasks due today · 1 overdue');
  });
});
