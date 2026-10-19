import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembersOverviewDto } from '@hearth/contracts';
import { ROLE_PERMISSIONS } from '@hearth/domain';
import { ApiError, http } from '@/shared/api/http';
import type * as HttpModuleNs from '@/shared/api/http';
import { renderApp, signIn, testMe } from '@/test/render';
import { MembersPage } from './MembersPage';

type HttpModule = typeof HttpModuleNs;

vi.mock('@/shared/api/http', async (orig) => ({
  ...(await orig<HttpModule>()),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const mocked = vi.mocked(http);

const member = (id: string, name: string, role: MembersOverviewDto['members'][number]['role'], extra: Partial<MembersOverviewDto['members'][number]> = {}) => ({
  id,
  name,
  initials: name.split(' ').map((w) => w[0]).join(''),
  avatarColor: 'blue' as const,
  email: `${name.split(' ')[0]!.toLowerCase()}@acme.com`,
  role,
  status: 'ACTIVE' as const,
  isGuest: role === 'GUEST',
  guestProjectCount: role === 'GUEST' ? 1 : null,
  teams: [],
  lastActiveAt: '2026-10-19T10:00:00Z',
  lastActiveLabel: 'Now',
  isYou: false,
  ...extra,
});

const overview: MembersOverviewDto = {
  members: [
    member('u-sara', 'Sara Ahmed', 'ADMIN', { isYou: true }),
    member('u-fawad', 'Fawad Iqbal', 'OWNER'),
    member('u-mo', 'Mo Khan', 'MEMBER', { teams: [{ id: 't1', name: 'Engineering', color: 'amber' }], lastActiveLabel: '1 hour ago' }),
    member('u-tom', 'Tom Walsh', 'GUEST', { email: 'tom@northwind.co' }),
    member('u-priya', 'Priya Oberoi', 'MEMBER', { status: 'DEACTIVATED', lastActiveLabel: 'Sep 2' }),
  ],
  counts: { members: 3, guests: 1, deactivated: 1, pendingInvites: 1, seatsUsed: 3, seatLimit: 10 },
  plan: { id: 'PRO', name: 'Pro' },
  identity: { sso: 'not_configured', scim: 'available_on_enterprise', summary: 'SSO: not configured · SCIM: available on Enterprise' },
};

describe('MembersPage', () => {
  beforeEach(() => {
    signIn({ ...testMe, user: { ...testMe.user, id: 'u-sara', name: 'Sara Ahmed' }, workspace: { ...testMe.workspace, role: 'ADMIN' }, permissions: [...ROLE_PERMISSIONS.ADMIN] });
    mocked.get.mockImplementation(async (path: string) => {
      if (path === '/admin/members') return overview as never;
      if (path === '/admin/invites')
        return [{ id: 'i1', email: 'lena@acme.com', role: 'MEMBER', team: null, project: null, meta: 'Member · Design · sent 2 days ago', sentAt: '', expiresAt: '', expired: false }] as never;
      return [] as never;
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the summary, SSO status, separated guests and pending invites', async () => {
    const { unmount } = renderApp(<MembersPage />, { route: '/settings/members' });
    expect(await screen.findByText('3 members · 1 guest · 1 pending invite · 3 of 10 seats on Pro')).toBeInTheDocument();
    expect(screen.getByText(/SSO: not configured · SCIM: available on Enterprise/)).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', { name: 'Guests' })).toHaveTextContent('Tom Walsh');
    expect(screen.getByRole('rowgroup', { name: 'Deactivated' })).toHaveTextContent('Priya Oberoi');
    expect(await screen.findByText('Member · Design · sent 2 days ago')).toBeInTheDocument();
    // You can't change your own role or an owner's.
    expect(screen.getByRole('button', { name: 'Role for Sara Ahmed: Admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Role for Fawad Iqbal: Owner' })).toBeDisabled();
    unmount();
  });

  it('changes a role optimistically and rolls back when the API refuses (403)', async () => {
    let reject: (e: unknown) => void = () => undefined;
    mocked.patch.mockImplementation(() => new Promise((_res, rej) => (reject = rej)));
    const { unmount } = renderApp(<MembersPage />, { route: '/settings/members' });
    const trigger = await screen.findByRole('button', { name: 'Role for Mo Khan: Member' });
    fireEvent.click(trigger);
    const listbox = await screen.findByRole('listbox', { name: 'Change role for Mo Khan' });
    // Plain-words descriptions next to each role; Owner is above an admin, so it's disabled.
    expect(within(listbox).getByText(/See and comment; can’t edit/)).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /^Owner/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(within(listbox).getByRole('option', { name: /^Viewer/ }));

    expect(await screen.findByRole('button', { name: 'Role for Mo Khan: Viewer' })).toBeInTheDocument();
    expect(mocked.patch).toHaveBeenCalledWith('/admin/members/u-mo/role', { role: 'VIEWER' });

    reject(new ApiError({ status: 403, kind: 'forbidden', code: 'roles.escalation', message: 'Admins can’t do that here.' }));
    expect(await screen.findByRole('button', { name: 'Role for Mo Khan: Member' })).toBeInTheDocument();
    expect(await screen.findByText('Admins can’t do that here.')).toBeInTheDocument();
    unmount();
  });

  it('confirms permanent removal in a dialog, and opens the permission matrix', async () => {
    mocked.get.mockImplementation(async (path: string) => {
      if (path === '/admin/members') return overview as never;
      if (path === '/admin/roles')
        return { roles: [{ role: 'OWNER', label: 'Owner', description: '' }, { role: 'ADMIN', label: 'Admin', description: '' }], matrix: [{ permission: 'billing.manage', label: 'Manage billing and plan', roles: ['OWNER'] }] } as never;
      return [] as never;
    });
    mocked.delete.mockResolvedValue({ userId: 'u-mo', unassignedTasks: 2 } as never);
    const { unmount } = renderApp(<MembersPage />, { route: '/settings/members' });
    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Mo Khan' }));
    fireEvent.click(await screen.findByRole('option', { name: /Remove from workspace/ }));
    const dialog = await screen.findByRole('alertdialog', { name: /Remove Mo Khan/ });
    expect(dialog).toHaveTextContent('can’t be undone');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove permanently' }));
    await waitFor(() => expect(mocked.delete).toHaveBeenCalledWith('/admin/members/u-mo', { body: { confirm: true } }));
    expect(await screen.findByText(/2 open tasks now unassigned/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Permission matrix' }));
    expect(await screen.findByRole('cell', { name: 'Owner: allowed' })).toBeInTheDocument();
    unmount();
  });
});
