import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/shared/api/client';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useUiStore } from '@/shared/layout/ui-store';
import { todayIso } from '@/shared/tasks/dates';
import { makeTask, mockPhoneViewport, signIn, testMe } from '@/test/render';
import { AppProviders, createQueryClient } from '../providers';
import { routes } from '../router';

vi.mock('@/shared/api/client', () => ({
  api: {
    auth: { login: vi.fn(), register: vi.fn() },
    me: { get: vi.fn(), update: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn(), createTag: vi.fn() },
    tasks: {
      list: vi.fn(),
      get: vi.fn(),
      getByKey: vi.fn(() => new Promise(() => undefined)),
      update: vi.fn(),
      quickAdd: vi.fn(),
      create: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
    },
  },
}));
vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() }),
}));

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

describe('MobileTabBar (phone shell)', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = mockPhoneViewport();
    useUiStore.setState({
      palette: { open: false, mode: 'search', scope: 'all', initialQuery: '' },
      createTask: { open: false, defaults: {} },
    });
    mocked.me.get.mockResolvedValue(testMe);
    mocked.workspace.shell.mockResolvedValue({
      favorites: [],
      teams: [],
      counts: { myTasks: 1, inbox: 4 },
      onboarding: { completed: 5, total: 5, nextStep: null },
    });
    mocked.workspace.members.mockResolvedValue([]);
    mocked.workspace.teams.mockResolvedValue([]);
    mocked.workspace.tags.mockResolvedValue([]);
    mocked.tasks.list.mockResolvedValue([
      makeTask({ id: 'a', key: 'HRT-142', title: 'Write onboarding checklist copy', dueDate: todayIso() }),
    ]);
    signIn();
  });
  afterEach(() => {
    restore();
    vi.clearAllMocks();
    useAuthStore.getState().signOut();
  });

  it('renders the four tabs with the active one from the route and the inbox badge', async () => {
    const { unmount } = renderAt('/my-tasks');
    await screen.findByText('Write onboarding checklist copy');
    const tabs = screen.getByRole('navigation', { name: 'Tabs' });
    expect(within(tabs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(within(tabs).getByRole('link', { name: 'My tasks' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    // Unread count is announced in text, and shown as a badge.
    const inbox = await within(tabs).findByRole('link', { name: 'Inbox, 4 unread' });
    expect(inbox).toHaveAttribute('href', '/inbox');
    expect(within(inbox).getByText('4')).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: 'Search' })).toBeInTheDocument();
    // The floating + replaces the top bar's New and bell.
    expect(screen.getByRole('button', { name: 'Create task' })).toBeInTheDocument();
    unmount();
  });

  it('Search opens the palette and + opens the create-task dialog', async () => {
    const { unmount } = renderAt('/my-tasks');
    await screen.findByText('Write onboarding checklist copy');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(useUiStore.getState().palette.open).toBe(true);
    useUiStore.getState().closePalette();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(useUiStore.getState().createTask.open).toBe(true);
    unmount();
  });

  it('marks the active tab on other routes and hides while a task sheet is open', async () => {
    const { router, unmount } = renderAt('/my-tasks');
    await screen.findByText('Write onboarding checklist copy');
    await act(() => router.navigate('/my-tasks?task=HRT-142'));
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Tabs' })).not.toBeInTheDocument());
    await act(() => router.navigate('/home'));
    const tabs = await screen.findByRole('navigation', { name: 'Tabs' });
    expect(within(tabs).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    unmount();
  });
});
