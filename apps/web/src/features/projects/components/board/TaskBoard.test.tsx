import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { useToastStore } from '@/shared/toast';
import { makeTask, renderApp, signIn } from '@/test/render';
import { TaskBoard } from './TaskBoard';

vi.mock('@/shared/api/client', () => ({
  api: {
    me: { get: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn() },
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

const tasks = [
  makeTask({
    id: 't201',
    key: 'HRT-201',
    title: 'Audit current site IA',
    status: 'TODO',
    boardPosition: 1024,
  }),
  makeTask({ id: 't204', key: 'HRT-204', title: 'Write homepage copy', status: 'TODO', boardPosition: 2048 }),
  makeTask({
    id: 't188',
    key: 'HRT-188',
    title: 'Design pricing page',
    status: 'IN_PROGRESS',
    boardPosition: 1024,
  }),
  makeTask({
    id: 't192',
    key: 'HRT-192',
    title: 'Build navigation',
    status: 'IN_PROGRESS',
    boardPosition: 2048,
  }),
  makeTask({
    id: 't195',
    key: 'HRT-195',
    title: 'Analytics events',
    status: 'IN_PROGRESS',
    boardPosition: 3072,
  }),
  makeTask({
    id: 't185',
    key: 'HRT-185',
    title: 'Accessibility pass',
    status: 'IN_REVIEW',
    boardPosition: 1024,
  }),
  makeTask({ id: 't170', key: 'HRT-170', title: 'Kickoff workshop', status: 'DONE', boardPosition: 1024 }),
];

const card = (key: string) => screen.getByRole('button', { name: new RegExp(`^${key} `) });

describe('TaskBoard', () => {
  beforeEach(() => {
    signIn();
    mocked.tasks.move.mockImplementation(async (id: string) => tasks.find((t) => t.id === id)! as never);
  });
  afterEach(() => vi.clearAllMocks());

  it('shows WIP label states: plain count, near (amber) and over', () => {
    let view = renderApp(<TaskBoard tasks={tasks} label="Board" wipLimits={{ IN_PROGRESS: 4 }} />);
    expect(screen.getByTestId('wip-TODO')).toHaveTextContent(/^2$/);
    const progress = screen.getByTestId('wip-IN_PROGRESS');
    expect(progress).toHaveTextContent('3 / 4 WIP');
    expect(progress).toHaveAttribute('data-warn', 'true');
    expect(progress).toHaveTextContent('Near the work-in-progress limit');
    view.unmount();
    view = renderApp(<TaskBoard tasks={tasks} label="Board" wipLimits={{ IN_PROGRESS: 2 }} />);
    expect(screen.getByTestId('wip-IN_PROGRESS')).toHaveTextContent('3 / 2 WIP');
    expect(screen.getByTestId('wip-IN_PROGRESS')).toHaveTextContent('Over the work-in-progress limit');
    view.unmount();
    view = renderApp(<TaskBoard tasks={tasks} label="Board" wipLimits={{ IN_PROGRESS: 8 }} />);
    expect(screen.getByTestId('wip-IN_PROGRESS')).not.toHaveAttribute('data-warn');
    view.unmount();
  });

  it('Alt+→ moves the focused card to the next column with the right neighbours and offers Undo', async () => {
    const { unmount } = renderApp(<TaskBoard tasks={tasks} label="Board" wipLimits={{ IN_PROGRESS: 4 }} />);
    const c = card('HRT-195');
    act(() => c.focus());
    fireEvent.keyDown(c, { key: 'ArrowRight', altKey: true });
    await waitFor(() =>
      expect(mocked.tasks.move).toHaveBeenCalledWith('t195', {
        status: 'IN_REVIEW',
        beforeId: 't185',
        afterId: null,
        ordering: 'board',
      }),
    );
    const toast = await screen.findByText('Moved HRT-195 to In review');
    fireEvent.click(
      within((toast.closest('.ht-toast') as HTMLElement) ?? toast.parentElement!).getByRole('button', {
        name: 'Undo',
      }),
    );
    await waitFor(() =>
      expect(mocked.tasks.move).toHaveBeenLastCalledWith('t195', {
        status: 'IN_PROGRESS',
        beforeId: 't192',
        afterId: null,
        ordering: 'board',
      }),
    );
    unmount();
  });

  it('Alt+↑ reorders within a column between the right neighbours', async () => {
    const { unmount } = renderApp(<TaskBoard tasks={tasks} label="Board" />);
    const c = card('HRT-195');
    act(() => c.focus());
    fireEvent.keyDown(c, { key: 'ArrowUp', altKey: true });
    await waitFor(() =>
      expect(mocked.tasks.move).toHaveBeenCalledWith('t195', {
        status: undefined,
        beforeId: 't188',
        afterId: 't192',
        ordering: 'board',
      }),
    );
    unmount();
  });

  it('M opens “Move to…”, and choosing a column moves the card to its bottom', async () => {
    const { unmount } = renderApp(<TaskBoard tasks={tasks} label="Board" />);
    const c = card('HRT-201');
    act(() => c.focus());
    act(() => {
      fireEvent.keyDown(c, { key: 'm' });
    });
    const menu = await screen.findByRole('menu', { name: 'Move HRT-201 to' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Done/ }));
    await waitFor(() =>
      expect(mocked.tasks.move).toHaveBeenCalledWith('t201', {
        status: 'DONE',
        beforeId: 't170',
        afterId: null,
        ordering: 'board',
      }),
    );
    unmount();
  });

  it('warns (without blocking) when a move puts a column over its WIP limit', async () => {
    const { unmount } = renderApp(<TaskBoard tasks={tasks} label="Board" wipLimits={{ IN_PROGRESS: 3 }} />);
    const c = card('HRT-204');
    act(() => c.focus());
    fireEvent.keyDown(c, { key: 'ArrowRight', altKey: true });
    await waitFor(() =>
      expect(mocked.tasks.move).toHaveBeenCalledWith(
        't204',
        expect.objectContaining({ status: 'IN_PROGRESS', beforeId: 't195' }),
      ),
    );
    await screen.findByText(/In progress is over its WIP limit \(4 \/ 3\)/);
    unmount();
  });

  it('done cards recede and Enter opens the task panel', () => {
    const { unmount, router } = renderApp(<TaskBoard tasks={tasks} label="Board" />, {
      route: '/projects/p1/board',
    });
    expect(card('HRT-170').style.opacity).toBe('0.72');
    fireEvent.keyDown(card('HRT-188'), { key: 'Enter' });
    expect(router.state.location.search).toBe('?task=HRT-188');
    unmount();
  });

  afterEach(() => useToastStore.getState().clear());
});
