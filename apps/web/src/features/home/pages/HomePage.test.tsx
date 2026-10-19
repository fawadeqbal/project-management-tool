import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingDto, ProjectTemplateDto } from '@hearth/contracts';
import { ROLE_PERMISSIONS } from '@hearth/domain';
import { api } from '@/shared/api/client';
import { http } from '@/shared/api/http';
import type * as HttpModuleNs from '@/shared/api/http';
import { useUiStore } from '@/shared/layout/ui-store';
import { renderApp, signIn, testMe } from '@/test/render';
import { useInviteDialogStore } from '@/features/settings';
import { HomePage } from './HomePage';

type HttpModule = typeof HttpModuleNs;

vi.mock('@/shared/api/http', async (orig) => ({
  ...(await orig<HttpModule>()),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/client', () => ({
  api: {
    me: { get: vi.fn(), update: vi.fn() },
    workspace: { members: vi.fn(), teams: vi.fn(), tags: vi.fn(), shell: vi.fn(), createTag: vi.fn() },
    tasks: { list: vi.fn() },
  },
}));
vi.mock('@/shared/realtime', () => ({ useRealtimeEvent: () => undefined }));

const mocked = vi.mocked(http);
const client = vi.mocked(api, true);

const onboarding: OnboardingDto = {
  steps: [
    { id: 'create-workspace', title: 'Create your workspace', hint: 'Done in 20 seconds', done: true, isNext: false },
    { id: 'start-from-template', title: 'Start from a template', hint: 'Templates beat the blank page', done: true, isNext: false },
    { id: 'create-first-task', title: 'Create your first task', hint: 'HRT-1 · Kickoff meeting', done: true, isNext: false },
    { id: 'invite-teammates', title: 'Invite 2 teammates', hint: 'Projects with 3+ people are far more likely to ship on time', done: false, isNext: true },
    { id: 'connect-slack', title: 'Connect Slack', hint: 'Get updates where your team already talks', done: false, isNext: false },
  ],
  completed: 3,
  total: 5,
  nextStep: 'Invite 2 teammates',
  isComplete: false,
  dismissed: false,
};
const templates: ProjectTemplateDto[] = [
  { id: 'product-sprint', name: 'Product sprint', description: 'Backlog, 2-week sprints, burndown', icon: 'board', color: 'sky', sections: ['Backlog'], taskCount: 7, featured: true },
  { id: 'marketing-campaign', name: 'Marketing campaign', description: 'Brief → content calendar → launch', icon: 'calendar-view', color: 'violet', sections: ['Brief'], taskCount: 8, featured: true },
  { id: 'client-project', name: 'Client project', description: 'Milestones, approvals, guest portal', icon: 'users', color: 'green', sections: ['Kickoff'], taskCount: 6, featured: true },
  { id: 'website-launch', name: 'Website launch', description: 'Sitemap, design, build, QA, go live', icon: 'globe', color: 'blue', sections: ['Discovery'], taskCount: 10, featured: false },
];

describe('HomePage', () => {
  beforeEach(() => {
    signIn({ ...testMe, workspace: { ...testMe.workspace, role: 'OWNER' }, permissions: [...ROLE_PERMISSIONS.OWNER] });
    mocked.get.mockImplementation(async (path: string) => (path === '/onboarding' ? onboarding : path === '/templates' ? templates : []) as never);
    client.tasks.list.mockResolvedValue([]);
    client.workspace.shell.mockResolvedValue({ favorites: [], teams: [], counts: { myTasks: 0, inbox: 0 }, onboarding: { completed: 3, total: 5, nextStep: 'Invite 2 teammates' } });
    client.workspace.teams.mockResolvedValue([]);
    useInviteDialogStore.setState({ open: false });
  });
  afterEach(() => vi.clearAllMocks());

  it('shows progress and highlights the single next step with its action', async () => {
    const { unmount } = renderApp(<HomePage />, { route: '/home' });
    expect(screen.getByRole('heading', { name: 'Welcome to Hearth, Fawad' })).toBeInTheDocument();
    expect(await screen.findByText('3 of 5 done')).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem').filter((li) => li.closest('ol'));
    const next = steps.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(next).toHaveLength(1);
    expect(next[0]).toHaveTextContent('Invite 2 teammates');
    expect(within(steps[0]!).getByText('Create your workspace')).toHaveClass(/stepTitleDone/);
    fireEvent.click(within(next[0]!).getByRole('button', { name: 'Invite' }));
    expect(useInviteDialogStore.getState().open).toBe(true);
    unmount();
  });

  it('shows the empty My tasks card with Create task and the shortcut tip, and featured templates', async () => {
    const { unmount } = renderApp(<HomePage />, { route: '/home' });
    expect(await screen.findByRole('heading', { name: 'Nothing on your plate yet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(useUiStore.getState().createTask.open).toBe(true);
    expect(await screen.findByRole('button', { name: /Start from Product sprint/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start from Website launch/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Browse all 4 templates/ }));
    expect(await screen.findByRole('button', { name: /Start from Website launch/ })).toBeInTheDocument();
    unmount();
  });

  it('applies a template and navigates to the new project board', async () => {
    mocked.post.mockResolvedValue({ project: { id: 'p9', name: 'Product sprint', color: 'sky' }, taskCount: 7, firstTaskKey: 'HRT-200' } as never);
    const { unmount, router } = renderApp(<HomePage />, { route: '/home' });
    fireEvent.click(await screen.findByRole('button', { name: /Start from Product sprint/ }));
    expect(await screen.findByText('“Product sprint” created with 7 tasks')).toBeInTheDocument();
    expect(mocked.post).toHaveBeenCalledWith('/templates/product-sprint/apply', {});
    expect(router.state.location.pathname).toBe('/projects/p9/board');
    unmount();
  });
});
