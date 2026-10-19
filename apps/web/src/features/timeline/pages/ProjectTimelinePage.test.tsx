import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineDto } from '@hearth/contracts';
import { http } from '@/shared/api/http';
import type * as HttpModule from '@/shared/api/http';
import type * as ProjectsModule from '@/features/projects';
import { useToastStore } from '@/shared/toast';
import { renderApp, signIn } from '@/test/render';
import { ProjectTimelinePage } from './ProjectTimelinePage';

vi.mock('@/shared/api/http', async (orig) => {
  const actual = await orig<typeof HttpModule>();
  return { ...actual, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});
vi.mock('@/shared/realtime', () => ({ useRealtimeEvent: () => undefined }));
vi.mock('@/features/projects', async (orig) => {
  const actual = await orig<typeof ProjectsModule>();
  return {
    ...actual,
    useProjectContext: () => ({
      project: { id: 'web', name: 'Website relaunch', members: [], wipLimits: {} },
      projectId: 'web',
    }),
  };
});
const mockedHttp = vi.mocked(http, true);

const timeline: TimelineDto = {
  projectId: 'web',
  from: '2026-10-11',
  to: '2026-11-21',
  today: '2026-10-19',
  rows: [
    { kind: 'section', id: 's-design', name: 'Design' },
    {
      kind: 'task',
      id: 'pricing',
      key: 'HRT-188',
      title: 'Pricing page design',
      status: 'IN_PROGRESS',
      sectionId: 's-design',
      startDate: '2026-10-23',
      dueDate: '2026-10-30',
      baselineStart: '2026-10-21',
      baselineDue: '2026-10-27',
      progress: 20,
      assignee: null,
      critical: true,
    },
    { kind: 'section', id: 's-build', name: 'Build' },
    {
      kind: 'task',
      id: 'nav',
      key: 'HRT-192',
      title: 'Responsive navigation',
      status: 'TODO',
      sectionId: 's-build',
      startDate: '2026-10-31',
      dueDate: '2026-11-07',
      baselineStart: null,
      baselineDue: null,
      progress: 0,
      assignee: null,
      critical: true,
    },
    {
      kind: 'task',
      id: 'analytics',
      key: 'HRT-195',
      title: 'Analytics events',
      status: 'TODO',
      sectionId: 's-build',
      startDate: '2026-11-04',
      dueDate: '2026-11-09',
      baselineStart: null,
      baselineDue: null,
      progress: 0,
      assignee: null,
      critical: false,
    },
    { kind: 'milestone', id: 'launch', name: 'Launch', date: '2026-11-14', done: false, critical: true },
  ],
  links: [
    { fromId: 'pricing', toId: 'nav', critical: true },
    { fromId: 'nav', toId: 'analytics', critical: false },
  ],
  criticalIds: ['pricing', 'nav', 'launch'],
  conflicts: [{ taskId: 'analytics', blockerId: 'nav', blockerKey: 'HRT-192', overlapDays: 4 }],
};

describe('ProjectTimelinePage', () => {
  beforeEach(() => {
    signIn();
    mockedHttp.get.mockImplementation(
      async (path: string) => (path.endsWith('/timeline') ? timeline : []) as never,
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clear();
  });

  it('renders sections, critical and normal bars, the conflict badge and dependency connectors', async () => {
    const { unmount } = renderWithPage();
    const bar = await screen.findByRole('button', { name: /^HRT-188 Pricing page design/ });
    expect(bar).toHaveAttribute('data-tone', 'critical');
    expect(screen.getByRole('button', { name: /^HRT-195 / })).toHaveAttribute('data-tone', 'normal');
    expect(
      screen.getByRole('img', { name: /Dependency conflict: starts before HRT-192/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Launch · Nov 14/)).toBeInTheDocument();
    expect(document.querySelectorAll('svg path[data-critical]').length).toBe(1);
    unmount();
  });

  it('zoom changes the scale (px per day)', async () => {
    const { unmount } = renderWithPage();
    const bar = await screen.findByRole('button', { name: /^HRT-188 / });
    expect(screen.getByTestId('timeline-chart').firstElementChild).toHaveAttribute('data-px', '19');
    const weekLeft = parseFloat(bar.style.left);
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Zoom' })).getByRole('radio', { name: 'Day' }),
    );
    expect(screen.getByTestId('timeline-chart').firstElementChild).toHaveAttribute('data-px', '44');
    const dayLeft = parseFloat(screen.getByRole('button', { name: /^HRT-188 / }).style.left);
    expect(dayLeft).toBeGreaterThan(weekLeft * 2);
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Zoom' })).getByRole('radio', { name: 'Month' }),
    );
    expect(screen.getByTestId('timeline-chart').firstElementChild).toHaveAttribute('data-px', '7');
    unmount();
  });

  it('→ on a focused bar reschedules (dependents shift) and Undo restores every previous date', async () => {
    mockedHttp.post.mockImplementation(async (path: string) => {
      if (path.includes('/reschedule'))
        return {
          task: {
            kind: 'task',
            id: 'pricing',
            label: 'HRT-188',
            days: 1,
            startDate: '2026-10-24',
            dueDate: '2026-10-31',
          },
          shifted: [
            { taskId: 'nav', key: 'HRT-192', days: 1, kind: 'task' },
            { taskId: 'analytics', key: 'HRT-195', days: 1, kind: 'task' },
          ],
          previous: [
            { kind: 'task', id: 'pricing', startDate: '2026-10-23', dueDate: '2026-10-30' },
            { kind: 'task', id: 'nav', startDate: '2026-10-31', dueDate: '2026-11-07' },
            { kind: 'task', id: 'analytics', startDate: '2026-11-04', dueDate: '2026-11-09' },
          ],
        } as never;
      return { updated: [] } as never;
    });
    const { unmount } = renderWithPage();
    const bar = await screen.findByRole('button', { name: /^HRT-188 / });
    act(() => bar.focus());
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(bar).toHaveAccessibleName(/Oct 24 to Oct 31/);
    await waitFor(() =>
      expect(mockedHttp.post).toHaveBeenCalledWith('/timeline/tasks/pricing/reschedule', {
        shiftDependents: true,
        startDate: '2026-10-24',
        dueDate: '2026-10-31',
      }),
    );
    const toast = await screen.findByText('Rescheduled HRT-188 · 2 dependents shifted');
    fireEvent.click(within(toast.closest('.ht-toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(mockedHttp.post).toHaveBeenCalledWith('/timeline/schedule', {
        items: [
          { kind: 'task', id: 'pricing', startDate: '2026-10-23', dueDate: '2026-10-30' },
          { kind: 'task', id: 'nav', startDate: '2026-10-31', dueDate: '2026-11-07' },
          { kind: 'task', id: 'analytics', startDate: '2026-11-04', dueDate: '2026-11-09' },
        ],
      }),
    );
    unmount();
  });

  it('Shift+← shortens the bar from the end', async () => {
    mockedHttp.post.mockResolvedValue({ task: {}, shifted: [], previous: [] } as never);
    const { unmount } = renderWithPage();
    const bar = await screen.findByRole('button', { name: /^HRT-188 / });
    act(() => bar.focus());
    fireEvent.keyDown(bar, { key: 'ArrowLeft', shiftKey: true });
    await waitFor(() =>
      expect(mockedHttp.post).toHaveBeenCalledWith(
        '/timeline/tasks/pricing/reschedule',
        expect.objectContaining({ startDate: '2026-10-23', dueDate: '2026-10-29' }),
      ),
    );
    unmount();
  });
});

function renderWithPage() {
  return renderApp(<ProjectTimelinePage />, { route: '/projects/web/timeline' });
}
