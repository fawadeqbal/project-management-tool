import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDetailDto } from '@hearth/contracts';
import { api } from '@/shared/api/client';
import { makeTask, renderApp, signIn } from '@/test/render';
import { TaskPanelHost } from './TaskPanelHost';

vi.mock('@/shared/api/client', () => ({
  api: {
    me: { get: vi.fn(), update: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn(), createTag: vi.fn() },
    tasks: {
      list: vi.fn(),
      get: vi.fn(),
      getByKey: vi.fn(),
      update: vi.fn(),
      addComment: vi.fn(),
      addDependency: vi.fn(),
      removeDependency: vi.fn(),
      follow: vi.fn(),
      unfollow: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

const mocked = vi.mocked(api, true);

const detail: TaskDetailDto = {
  ...makeTask({
    id: 't188',
    key: 'HRT-188',
    title: 'Design pricing page in light and dark mode',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
  }),
  description: 'Light and dark comps.',
  creator: { id: 'u1', name: 'Fawad Iqbal', initials: 'FI', avatarColor: 'blue' },
  subtasks: [
    makeTask({ id: 's1', key: 'HRT-189', title: 'Light mode comps', status: 'DONE', parentId: 't188' }),
    makeTask({ id: 's2', key: 'HRT-190', title: 'Dark mode contrast fixes', parentId: 't188' }),
  ],
  comments: [
    {
      id: 'c1',
      taskId: 't188',
      author: { id: 'u2', name: 'Sara Ahmed', initials: 'SA', avatarColor: 'green' },
      body: '@Fawad the annual toggle label is 3.9:1 in dark mode',
      parentId: null,
      mentions: [{ id: 'u1', name: 'Fawad Iqbal', initials: 'FI', avatarColor: 'blue' }],
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      editedAt: null,
    },
  ],
  activity: [],
  blocking: [],
  followerIds: [],
  sprint: { id: 'sp24', name: 'Sprint 24' },
};

describe('TaskPanelHost', () => {
  beforeEach(() => {
    signIn();
    mocked.tasks.getByKey.mockResolvedValue(detail);
    mocked.workspace.members.mockResolvedValue([]);
    mocked.workspace.tags.mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('opens from ?task=KEY and shows the task', async () => {
    const { unmount } = renderApp(<TaskPanelHost />, { route: '/my-tasks?task=HRT-188' });
    expect(await screen.findByRole('complementary', { name: 'Task HRT-188' })).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('@Fawad')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    unmount();
  });

  it('edits the title inline and saves on Enter', async () => {
    // A tiny stateful "server" so the refetch after saving returns the new title.
    let current = detail;
    mocked.tasks.getByKey.mockImplementation(async () => current);
    mocked.tasks.update.mockImplementation(
      async (_id, patch) => (current = { ...current, ...patch } as TaskDetailDto),
    );
    const { unmount } = renderApp(<TaskPanelHost />, { route: '/my-tasks?task=HRT-188' });
    fireEvent.click(
      await screen.findByRole('button', { name: /Design pricing page in light and dark mode\. Edit title/ }),
    );
    const input = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.change(input, { target: { value: 'Design pricing page v2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Optimistic: the new title shows right away.
    expect(
      await screen.findByRole('button', { name: /Design pricing page v2\. Edit title/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocked.tasks.update).toHaveBeenCalledWith('t188', { title: 'Design pricing page v2' }),
    );
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    unmount();
  });

  it('Esc cancels a title edit without saving', async () => {
    const { unmount } = renderApp(<TaskPanelHost />, { route: '/my-tasks?task=HRT-188' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit title/ }));
    const input = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.change(input, { target: { value: 'Something else' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mocked.tasks.update).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /Design pricing page in light and dark mode\. Edit title/ }),
    ).toBeInTheDocument();
    unmount();
  });

  it('closes with the close button', async () => {
    const { unmount, router } = renderApp(<TaskPanelHost />, { route: '/my-tasks?task=HRT-188' });
    fireEvent.click(await screen.findByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    unmount();
  });
});
