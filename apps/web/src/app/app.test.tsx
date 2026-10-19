import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useUiStore } from '@/shared/layout/ui-store';
import { todayIso } from '@/shared/tasks/dates';
import { makeTask, signIn, testMe } from '@/test/render';
import { AppProviders, createQueryClient } from './providers';
import { routes } from './router';

vi.mock('@/shared/api/client', () => ({
  api: {
    auth: { login: vi.fn(), register: vi.fn() },
    me: { get: vi.fn(), update: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn(), createTag: vi.fn() },
    tasks: { list: vi.fn(), get: vi.fn(), getByKey: vi.fn(), update: vi.fn(), quickAdd: vi.fn(), create: vi.fn(), move: vi.fn(), remove: vi.fn() },
  },
}));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }) }));

const mocked = vi.mocked(api, true);

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router };
};

describe('app routes', () => {
  beforeEach(() => {
    useUiStore.setState({ palette: { open: false, mode: 'search', scope: 'all', initialQuery: '' }, shortcutsOpen: false });
    mocked.me.get.mockResolvedValue(testMe);
    mocked.workspace.shell.mockResolvedValue({
      favorites: [{ id: 'p1', name: 'Website relaunch', color: 'blue' }],
      teams: [{ id: 't1', name: 'Design', color: 'green', memberIds: ['u1'] }],
      counts: { myTasks: 1, inbox: 3 },
      onboarding: { completed: 3, total: 5, nextStep: 'invite 2 teammates' },
    });
    mocked.workspace.members.mockResolvedValue([]);
    mocked.workspace.teams.mockResolvedValue([]);
    mocked.workspace.tags.mockResolvedValue([]);
    mocked.tasks.list.mockResolvedValue([makeTask({ id: 'a', key: 'HRT-142', title: 'Write onboarding checklist copy', dueDate: todayIso() })]);
  });
  afterEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().signOut();
  });

  it('sends signed-out visitors to /login with a return path', async () => {
    const { router, unmount } = renderAt('/my-tasks');
    expect(await screen.findByRole('heading', { name: 'Log in to Hearth' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fmy-tasks');
    unmount();
  });

  it('redirects / to My tasks and renders the shell', async () => {
    signIn();
    const { router, unmount } = renderAt('/');
    await screen.findByText('Write onboarding checklist copy');
    expect(router.state.location.pathname).toBe('/my-tasks');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /My tasks/ })).toHaveAttribute('aria-current', 'page');
    expect(await within(nav).findByRole('link', { name: 'Website relaunch' })).toHaveAttribute('href', '/projects/p1');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('My tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    unmount();
  });

  it('opens the command palette with Ctrl+K and runs a navigation command', async () => {
    signIn();
    const { router, unmount } = renderAt('/my-tasks');
    await screen.findByText('Write onboarding checklist copy');
    act(() => {
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    });
    const input = await screen.findByRole('combobox', { name: 'Search or run a command' });
    fireEvent.change(input, { target: { value: 'go to home' } });
    expect(await screen.findByText(/Matched locally in \d+ ms/)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    unmount();
  });

  it('shows Goals as coming soon and a friendly 404', async () => {
    signIn();
    const { router, unmount } = renderAt('/goals');
    expect(await screen.findByText('Goals are on the way')).toBeInTheDocument();
    await act(() => router.navigate('/nowhere'));
    expect(await screen.findByText('We couldn’t find that page')).toBeInTheDocument();
    unmount();
  });

  it('G then M navigates to My tasks', async () => {
    signIn();
    const { router, unmount } = renderAt('/goals');
    await screen.findByText('Goals are on the way');
    act(() => {
      fireEvent.keyDown(document.body, { key: 'g' });
      fireEvent.keyDown(document.body, { key: 'm' });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-tasks'));
    unmount();
  });
});
