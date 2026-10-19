import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { installPointerEvents, makeTask, mockPhoneViewport, renderApp, signIn } from '@/test/render';
import { toDateOnly, addDays } from '@hearth/domain';
import { today, todayIso } from './dates';
import { TaskList } from './TaskList';

vi.mock('@/shared/api/client', () => ({
  api: {
    tasks: { update: vi.fn() },
    workspace: { members: vi.fn(async () => []), shell: vi.fn(async () => undefined) },
  },
}));

const mocked = vi.mocked(api, true);

const yesterday = toDateOnly(addDays(today(), -2));
const tomorrow = toDateOnly(addDays(today(), 1));
const tasks = [
  makeTask({
    id: 't1',
    key: 'HRT-118',
    title: 'Review Q3 analytics dashboard with leadership feedback',
    status: 'IN_REVIEW',
    priority: 'URGENT',
    dueDate: yesterday,
    tags: [{ id: 'g1', name: 'Analytics', color: 'sky' }],
  }),
  makeTask({ id: 't2', key: 'HRT-142', title: 'Write onboarding checklist copy', dueDate: todayIso() }),
];

const swipe = (el: HTMLElement, dx: number, dy = 0) => {
  const x = 200;
  const y = 30;
  fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  // A few moves, like a real finger.
  for (const f of [0.1, 0.4, 0.7, 1])
    fireEvent.pointerMove(el, { clientX: x + dx * f, clientY: y + dy * f, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: x + dx, clientY: y + dy, pointerId: 1 });
};

describe('TaskList on phones (MobileTaskRow)', () => {
  let restoreViewport: () => void;
  let restorePointer: () => void;
  beforeEach(() => {
    signIn();
    restoreViewport = mockPhoneViewport();
    restorePointer = installPointerEvents(390);
    mocked.tasks.update.mockImplementation(async (id, patch) => ({
      ...tasks.find((t) => t.id === id)!,
      ...(patch as object),
    }));
  });
  afterEach(() => {
    restoreViewport();
    restorePointer();
    vi.clearAllMocks();
  });

  const renderList = (onOpen = vi.fn()) =>
    renderApp(<TaskList tasks={tasks} label="My tasks" onOpen={onOpen} hideAssignee />);

  it('renders the title on its own line with a meta line (key · due · status · tag) and no avatar', () => {
    const { unmount } = renderList();
    const row = screen.getByRole('row', { name: /HRT-118/ });
    expect(row).toHaveAttribute('data-swipe-row');
    expect(
      within(row).getByText('Review Q3 analytics dashboard with leadership feedback'),
    ).toBeInTheDocument();
    expect(within(row).getByText('HRT-118')).toBeInTheDocument();
    // Overdue is said in words, not only in red.
    expect(within(row).getByText(/Overdue, due/)).toBeInTheDocument();
    expect(within(row).getByRole('img', { name: 'In review' })).toBeInTheDocument();
    expect(within(row).getByText('Analytics')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox', { name: 'Mark HRT-118 as done' })).toBeInTheDocument();
    expect(within(row).queryByText('FI')).not.toBeInTheDocument();
    unmount();
  });

  it('tap opens the task; the checkbox completes it with Undo', async () => {
    const onOpen = vi.fn();
    const { unmount } = renderList(onOpen);
    fireEvent.click(screen.getByText('Write onboarding checklist copy'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'HRT-142' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark HRT-142 as done' }));
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenCalledWith('t2', { status: 'DONE' }));
    expect(await screen.findByText('HRT-142 marked as done')).toBeInTheDocument();
    unmount();
  });

  it('swipe right completes, swipe left snoozes to tomorrow — both with Undo', async () => {
    const onOpen = vi.fn();
    const { unmount } = renderList(onOpen);
    act(() => swipe(screen.getByRole('row', { name: /HRT-142/ }), 200));
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenCalledWith('t2', { status: 'DONE' }));
    expect(await screen.findByText('HRT-142 marked as done')).toBeInTheDocument();

    act(() => swipe(screen.getByRole('row', { name: /HRT-118/ }), -200));
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenCalledWith('t1', { dueDate: tomorrow }));
    expect(await screen.findByText('HRT-118 snoozed to tomorrow')).toBeInTheDocument();
    // A swipe is not a tap.
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    await waitFor(() => expect(mocked.tasks.update).toHaveBeenCalledWith('t1', { dueDate: yesterday }));
    unmount();
  });

  it('a short or vertical drag does nothing', () => {
    const { unmount } = renderList();
    const row = screen.getByRole('row', { name: /HRT-142/ });
    act(() => swipe(row, 60));
    act(() => swipe(row, 30, 240));
    expect(mocked.tasks.update).not.toHaveBeenCalled();
    unmount();
  });
});
