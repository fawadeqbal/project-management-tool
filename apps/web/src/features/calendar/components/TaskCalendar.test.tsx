import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { useToastStore } from '@/shared/toast';
import { makeTask, renderApp, signIn } from '@/test/render';
import { TaskCalendar } from './TaskCalendar';

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
const web = { id: 'web', name: 'Website relaunch', color: 'blue' as const };
const brand = { id: 'brand', name: 'Q4 brand campaign', color: 'violet' as const };

const busy = [
  'Update pricing table',
  'Wireframes & IA',
  'Push notification copy',
  'Social teaser',
  'Ad budget review',
].map((title, i) =>
  makeTask({
    id: `b${i}`,
    key: `HRT-${300 + i}`,
    title,
    dueDate: '2026-10-23',
    project: i % 2 ? brand : web,
    projectId: i % 2 ? 'brand' : 'web',
  }),
);
const scheduled = [
  ...busy,
  makeTask({
    id: 'k',
    key: 'HRT-170',
    title: 'Kickoff workshop',
    status: 'DONE',
    dueDate: '2026-10-12',
    project: web,
  }),
];
const unscheduled = [
  makeTask({ id: 'u1', key: 'HRT-207', title: 'Collect customer logos', priority: 'LOW', project: web }),
];

const renderCal = (range: 'month' | 'week' = 'month') =>
  renderApp(
    <TaskCalendar
      scheduled={scheduled}
      unscheduled={unscheduled}
      cursor="2026-10-19"
      range={range}
      onCursorChange={() => undefined}
      onRangeChange={() => undefined}
      label="Calendar"
    />,
  );

describe('TaskCalendar', () => {
  beforeEach(() => {
    // The fixtures are laid out around Monday, Oct 19 2026; pin "today" so the suite never drifts.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T09:00:00Z'));
    signIn();
    mocked.tasks.update.mockImplementation(
      async (id: string, patch) => ({ ...unscheduled[0]!, id, ...patch }) as never,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useToastStore.getState().clear();
  });

  it('shows at most 3 chips then “+N more”, which opens a popover listing all of them', async () => {
    const { unmount } = renderCal();
    const cell = screen.getByRole('gridcell', { name: /Friday, October 23, 5 tasks/ });
    expect(within(cell).getAllByRole('button', { name: /^HRT-30\d/ })).toHaveLength(3);
    fireEvent.click(within(cell).getByRole('button', { name: '+2 more' }));
    const pop = await screen.findByText('Friday, October 23');
    const popover = pop.parentElement!;
    expect(within(popover).getAllByRole('button', { name: /^HRT-30\d/ })).toHaveLength(5);
    expect(within(popover).getByText('Ad budget review')).toBeInTheDocument();
    unmount();
  });

  it('strikes through done chips, fills only today and lists projects in the legend', () => {
    const { unmount } = renderCal();
    expect(screen.getByRole('button', { name: /^HRT-170 Kickoff workshop, Done/ })).toHaveAttribute(
      'data-done',
      'true',
    );
    expect(document.querySelectorAll('[data-today]')).toHaveLength(1);
    const legend = screen.getByRole('complementary', { name: 'Unscheduled tasks' });
    expect(within(legend).getByText('Website relaunch')).toBeInTheDocument();
    expect(within(legend).getByText('Q4 brand campaign')).toBeInTheDocument();
    unmount();
  });

  it('schedules a tray task with the keyboard (S, then Enter on a day) with Undo', async () => {
    const { unmount } = renderCal();
    const item = screen.getByRole('button', { name: /^HRT-207 Collect customer logos/ });
    act(() => item.focus());
    fireEvent.keyDown(item, { key: 's' });
    await screen.findByText(/Choose a day for HRT-207/);
    const day = screen.getByRole('gridcell', { name: /Monday, October 26/ });
    act(() => day.focus());
    fireEvent.keyDown(day, { key: 'Enter' });
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenCalledWith('u1', { dueDate: '2026-10-26' }));
    const toast = await screen.findByText('HRT-207 scheduled for Oct 26');
    fireEvent.click(within(toast.closest('.ht-toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenLastCalledWith('u1', { dueDate: null }));
    unmount();
  });

  it('moves day focus with the arrow keys and opens the day popover with Enter', async () => {
    const { unmount } = renderCal();
    const today = screen.getByRole('gridcell', { name: /Monday, October 19, today/ });
    expect(today).toHaveAttribute('tabindex', '0');
    act(() => today.focus());
    fireEvent.keyDown(today, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('gridcell', { name: /Tuesday, October 20/ })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('gridcell', { name: /Tuesday, October 20/ }), { key: 'ArrowDown' });
    const target = screen.getByRole('gridcell', { name: /Tuesday, October 27/ });
    await waitFor(() => expect(target).toHaveFocus());
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(await screen.findByText(/Nothing due. Drag a task here/)).toBeInTheDocument();
    unmount();
  });

  it('Week view reuses the same chips without collapsing', () => {
    const { unmount } = renderCal('week');
    const cell = screen.getByRole('gridcell', { name: /Friday, October 23/ });
    expect(within(cell).getAllByRole('button', { name: /^HRT-30\d/ })).toHaveLength(5);
    expect(screen.getAllByRole('gridcell')).toHaveLength(7);
    unmount();
  });
});
