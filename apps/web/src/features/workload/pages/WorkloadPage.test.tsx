import type * as HttpModule from '@/shared/api/http';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { renderApp, signIn } from '@/test/render';
import { http } from '@/shared/api/http';
import { workloadFixture } from '../test-fixtures';
import { reassignInWorkload } from '../lib/workload-format';
import { WorkloadPage } from './WorkloadPage';

vi.mock('@/shared/api/client', () => ({
  api: {
    me: { get: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn() },
    tasks: { update: vi.fn(), list: vi.fn() },
  },
}));
vi.mock('@/shared/api/http', async (importOriginal) => {
  const mod = await importOriginal<typeof HttpModule>();
  return { ...mod, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const mockedHttp = vi.mocked(http, true);

describe('WorkloadPage', () => {
  beforeEach(() => {
    signIn();
    mockedApi.workspace.teams.mockResolvedValue([]);
    mockedApi.workspace.members.mockResolvedValue([]);
    mockedHttp.get.mockImplementation(
      async (path: string) => (path === '/workload' ? workloadFixture() : []) as never,
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('answers "who is overloaded?" first and labels every cell with a number, icon or hatching', async () => {
    renderApp(<WorkloadPage />, { route: '/workload', path: '/workload' });
    await screen.findByRole('grid', { name: 'Team workload' });

    expect(screen.getByText('Over capacity', { selector: '.ht-kpi-label' })).toBeInTheDocument();
    expect(screen.getByText('Mo (Tue–Wed)')).toBeInTheDocument();
    expect(screen.getByText('Jia · Thu 22 – Fri 23')).toBeInTheDocument();

    const over = screen.getByRole('button', { name: 'Wed 21: 11 of 8 hours planned — over capacity' });
    expect(over).toHaveAttribute('data-state', 'over');
    expect(over).toHaveTextContent('11h');
    expect(within(over).getByTestId('over-icon')).toBeInTheDocument();

    const full = screen.getByRole('button', { name: 'Mon 19: 8 of 8 hours planned' });
    expect(full).toHaveAttribute('data-state', 'full');
    expect(within(full).queryByTestId('over-icon')).toBeNull();

    const off = screen.getAllByRole('button', { name: /^(Thu 22|Fri 23): time off$/ });
    expect(off).toHaveLength(2);
    off.forEach((c) => {
      expect(c).toHaveAttribute('data-state', 'off');
      expect(c).toHaveTextContent('Off');
    });
    expect(screen.getByRole('button', { name: 'Tue 20: 3 of 8 hours planned' })).toHaveAttribute(
      'data-state',
      'light',
    );
  });

  it('moves focus with arrow keys and opens the day’s tasks with Enter', async () => {
    renderApp(<WorkloadPage />, { route: '/workload', path: '/workload' });
    const first = await screen.findByRole('button', { name: 'Mon 19: 8 of 8 hours planned' });
    expect(first).toHaveAttribute('tabindex', '0');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    const wed = screen.getByRole('button', { name: /^Wed 21: 11 of 8/ });
    expect(wed).toHaveFocus();
    fireEvent.keyDown(wed, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Wed 21: 0 of 8 hours planned' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.click(document.activeElement!);
    const dialog = await screen.findByRole('dialog', { name: 'Tasks this day' });
    expect(within(dialog).getByText('HRT-192')).toBeInTheDocument();
    expect(within(dialog).getByText('3h')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Reassign…' })).toHaveLength(2);
  });

  it('shows the AI suggestion with its source, and Accept reassigns with Undo', async () => {
    mockedApi.tasks.update.mockResolvedValue({} as never);
    renderApp(<WorkloadPage />, { route: '/workload', path: '/workload' });
    const card = await screen.findByRole('region', { name: 'Suggestion' });
    expect(card).toHaveTextContent('Suggestion:');
    expect(card).toHaveTextContent('based on this week’s estimates');
    fireEvent.click(within(card).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mockedApi.tasks.update).toHaveBeenCalledWith('t195', { assigneeId: 'ravi' }));
    expect(await screen.findByText('HRT-195 reassigned to Ravi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Suggestion' })).toBeNull();
  });
});

describe('reassignInWorkload', () => {
  it('moves a task’s daily shares to the new person and recomputes states', () => {
    const next = reassignInWorkload(workloadFixture(), 't195', 'ravi');
    const mo = next.people[0]!;
    const ravi = next.people[2]!;
    expect(mo.cells[2]).toMatchObject({ planned: 8, state: 'full' });
    expect(mo.overDays).toEqual([]);
    expect(ravi.cells[2]).toMatchObject({ planned: 6, state: 'normal' });
    expect(ravi.cells[4]).toMatchObject({ planned: 8, state: 'full' });
    expect(next.tasks.t195!.assigneeId).toBe('ravi');
  });
});
