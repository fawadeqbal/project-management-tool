import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalDetailDto, InboxDto, InboxItemDto } from '@hearth/contracts';
import { renderApp, signIn } from '@/test/render';
import { InboxPage, MARK_READ_DELAY_MS } from './InboxPage';
import type * as HttpModule from '@/shared/api/http';

// Route the feature's HTTP calls to spies (the real api.ts + hooks run on top).
const routes = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  unread: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  snooze: vi.fn(),
  unsnooze: vi.fn(),
  bulk: vi.fn(),
  approval: vi.fn(),
  decide: vi.fn(),
}));

vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof HttpModule>();
  const get = async (path: string, query?: Record<string, unknown>) => {
    if (path === '/inbox') return routes.list(query?.tab, !!query?.unread);
    const m = path.match(/^\/approvals\/([^/]+)$/);
    if (m) return routes.approval(m[1]);
    throw new Error(`unexpected GET ${path}`);
  };
  const post = async (path: string, body?: Record<string, unknown>) => {
    if (path === '/inbox/bulk') return routes.bulk(body?.ids, body?.action);
    const t = path.match(/^\/inbox\/([^/]+)\/(read|unread|archive|unarchive|snooze|unsnooze)$/);
    if (t) return t[2] === 'snooze' ? routes.snooze(t[1], body?.preset) : routes[t[2] as 'read'](t[1]);
    const d = path.match(/^\/approvals\/([^/]+)\/decision$/);
    if (d) return routes.decide(d[1], body?.decision, body?.note);
    throw new Error(`unexpected POST ${path}`);
  };
  return { ...actual, http: { ...actual.http, get, post } };
});

vi.mock('@/shared/api/client', () => ({
  api: {
    tasks: { getByKey: vi.fn(() => new Promise(() => undefined)), get: vi.fn(() => new Promise(() => undefined)), addComment: vi.fn() },
    workspace: { members: vi.fn(async () => []), shell: vi.fn(async () => undefined) },
  },
}));

const mocked = routes;
const now = Date.now();
const user = (initials: string, name: string) => ({ id: `u-${initials}`, name, initials, avatarColor: 'violet' as const });

const item = (over: Partial<InboxItemDto> & Pick<InboxItemDto, 'id' | 'title'>): InboxItemDto => ({
  type: 'MENTION',
  actor: user('SA', 'Sara Ahmed'),
  context: 'Website relaunch · HRT-188',
  excerpt: null,
  icon: 'comment',
  taskId: 't188',
  taskKey: 'HRT-188',
  approvalId: null,
  unread: false,
  createdAt: new Date(now - 60_000).toISOString(),
  time: '9:42',
  snoozedUntil: null,
  ...over,
});

const approvalItem = item({
  id: 'n1',
  type: 'APPROVAL_REQUESTED',
  title: 'Jia Li requested your approval',
  actor: user('JL', 'Jia Li'),
  context: 'Q4 brand campaign · HRT-328',
  excerpt: 'Homepage copy v3 — ready for approval',
  icon: 'status-done',
  taskId: 't328',
  taskKey: 'HRT-328',
  approvalId: 'a1',
  unread: true,
});
const mention = item({ id: 'n2', title: 'Sara Ahmed mentioned you', excerpt: '@Fawad the toggle is 3.9:1', unread: true });
const status = item({ id: 'n3', type: 'STATUS_CHANGED', title: 'Nadia Bashir changed status to Blocked', actor: user('NB', 'Nadia Bashir'), icon: 'status-blocked' });

const inbox = (items: InboxItemDto[]): InboxDto => ({
  items,
  counts: { all: items.length, unread: items.filter((i) => i.unread).length, mentions: items.filter((i) => i.type === 'MENTION' && i.unread).length, assigned: 0, approvals: items.filter((i) => i.type === 'APPROVAL_REQUESTED' && i.unread).length },
});

const approval: ApprovalDetailDto = {
  id: 'a1',
  title: 'Homepage copy v3 — ready for approval',
  summary: 'Changes from v2: tightened the hero to one sentence.',
  status: 'PENDING',
  task: { id: 't328', key: 'HRT-328', title: 'Homepage copy v3 — ready for approval', status: 'IN_REVIEW' },
  project: { id: 'p', name: 'Q4 brand campaign', color: 'violet' },
  context: 'Q4 brand campaign · HRT-328',
  requester: user('JL', 'Jia Li'),
  askedLine: 'Jia Li asked you and Sara Ahmed to approve',
  approvedCount: 1,
  approverCount: 2,
  progressLabel: '1 of 2 approvals',
  dueDate: '2026-10-20',
  dueLabel: 'Approval due tomorrow',
  dueTone: 'warning',
  attachments: [{ id: 'f1', name: 'hero-v3.png', kind: 'file', url: 'https://files.acme.com/hero-v3.png', sizeBytes: 1258291, label: 'hero-v3.png · 1.2 MB' }],
  approvers: [
    { user: user('SA', 'Sara Ahmed'), decision: 'APPROVED', label: 'Approved', note: null, decidedAt: null, isMe: false },
    { user: { ...user('FI', 'Fawad Iqbal'), id: 'u1' }, decision: 'PENDING', label: 'Waiting on you', note: null, decidedAt: null, isMe: true },
  ],
  myDecision: 'PENDING',
  canDecide: true,
  createdAt: new Date(now).toISOString(),
  resolvedAt: null,
};

const key = (k: string, opts: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key: k, ...opts });
const ok = { updated: 1 };

describe('InboxPage', () => {
  // A tiny stateful server so refetches after a mutation agree with the optimistic state.
  let server: Map<string, InboxItemDto>;
  const visible = (tab: string) =>
    [...server.values()].filter((i) => tab === 'all' || (tab === 'mentions' && i.type === 'MENTION') || (tab === 'approvals' && i.type === 'APPROVAL_REQUESTED'));
  beforeEach(() => {
    signIn();
    server = new Map([approvalItem, mention, status].map((i) => [i.id, { ...i }]));
    const hidden = new Map<string, InboxItemDto>();
    const set = (id: string, patch: Partial<InboxItemDto>) => server.set(id, { ...server.get(id)!, ...patch });
    const hide = (id: string) => {
      hidden.set(id, server.get(id)!);
      server.delete(id);
    };
    const restore = (id: string) => {
      if (hidden.has(id)) server.set(id, hidden.get(id)!);
    };
    mocked.list.mockImplementation(async (tab: string) => inbox(visible(tab)));
    mocked.approval.mockResolvedValue(approval);
    mocked.read.mockImplementation(async (id: string) => (set(id, { unread: false }), ok));
    mocked.unread.mockImplementation(async (id: string) => (set(id, { unread: true }), ok));
    mocked.archive.mockImplementation(async (id: string) => (hide(id), ok));
    mocked.snooze.mockImplementation(async (id: string) => (hide(id), ok));
    mocked.unarchive.mockImplementation(async (id: string) => (restore(id), ok));
    mocked.unsnooze.mockImplementation(async (id: string) => (restore(id), ok));
    mocked.bulk.mockImplementation(async (ids: string[], action: string) => (ids.forEach((id) => (action === 'archive' ? hide(id) : set(id, { unread: action === 'unread' }))), ok));
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders the list like the design and the approval detail', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    const list = await screen.findByRole('listbox', { name: 'Inbox items' });
    const options = await within(list).findAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    // Unread is announced in text, not only by the dot/weight.
    expect(within(options[0]!).getByText('Unread:', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mentions 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Approvals 1' })).toBeInTheDocument();
    expect(await screen.findByText('Jia Li asked you and Sara Ahmed to approve · 1 of 2 approvals')).toBeInTheDocument();
    expect(screen.getByText('Approval due tomorrow')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hero-v3\.png · 1\.2 MB/ })).toBeInTheDocument();
    expect(screen.getByText('Waiting on you')).toBeInTheDocument();
    unmount();
  });

  it('marks the selected item read after a second', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    await screen.findByRole('listbox', { name: 'Inbox items' });
    expect(mocked.read).not.toHaveBeenCalled();
    await waitFor(() => expect(mocked.read).toHaveBeenCalledWith('n1'), { timeout: MARK_READ_DELAY_MS + 1000 });
    unmount();
  });

  it('J/K move the selection; E archives with Undo', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    await screen.findByText('Jia Li requested your approval');
    act(() => void key('j'));
    expect(screen.getByRole('option', { name: /Sara Ahmed mentioned you/ })).toHaveAttribute('aria-selected', 'true');
    act(() => void key('k'));
    act(() => void key('j'));
    act(() => void key('e'));
    // Optimistic: gone right away, next item selected.
    await waitFor(() => expect(screen.queryByRole('option', { name: /Sara Ahmed mentioned you/ })).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: /Nadia Bashir/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(mocked.archive).toHaveBeenCalledWith('n2'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(mocked.unarchive).toHaveBeenCalledWith('n2'));
    expect(await screen.findByRole('option', { name: /Sara Ahmed mentioned you/ })).toBeInTheDocument();
    unmount();
  });

  it('H opens the snooze menu; picking Tomorrow hides the item with Undo', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    await screen.findByText('Jia Li requested your approval');
    act(() => void key('j'));
    act(() => void key('h'));
    fireEvent.click(await screen.findByRole('option', { name: /Tomorrow/ }));
    await waitFor(() => expect(mocked.snooze).toHaveBeenCalledWith('n2', 'tomorrow'));
    expect(screen.queryByRole('option', { name: /Sara Ahmed mentioned you/ })).not.toBeInTheDocument();
    expect(screen.getByText('Snoozed until tomorrow')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(mocked.unsnooze).toHaveBeenCalledWith('n2'));
    unmount();
  });

  it('U toggles unread on the selected item', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    await screen.findByText('Jia Li requested your approval');
    act(() => void key('j'));
    act(() => void key('j'));
    const nadia = screen.getByRole('option', { name: /Nadia Bashir/ });
    expect(nadia).not.toHaveAttribute('data-unread');
    act(() => void key('u'));
    await waitFor(() => expect(mocked.unread).toHaveBeenCalledWith('n3'));
    expect(screen.getByRole('option', { name: /Nadia Bashir/ })).toHaveAttribute('data-unread', 'true');
    act(() => void key('u'));
    await waitFor(() => expect(mocked.read).toHaveBeenCalledWith('n3'));
    unmount();
  });

  it('X selects items for bulk actions', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    await screen.findByText('Jia Li requested your approval');
    act(() => void key('x'));
    act(() => void key('j'));
    act(() => void key('x'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Selected items' })).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mocked.bulk).toHaveBeenCalledWith(['n1', 'n2'], 'archive'));
    expect(screen.getByText('Archived 2 items')).toBeInTheDocument();
    unmount();
  });

  it('approves optimistically and with Shift+A', async () => {
    let resolve!: (v: ApprovalDetailDto) => void;
    mocked.decide.mockImplementation(() => new Promise<ApprovalDetailDto>((r) => (resolve = r)));
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Note for Jia (optional)' }), { target: { value: 'Ship it' } });
    act(() => void key('A', { shiftKey: true }));
    // Before the server answers: my row already says Approved and the buttons are gone.
    await waitFor(() => expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(2));
    expect(screen.getByText(/2 of 2 approvals/)).toBeInTheDocument();
    expect(mocked.decide).toHaveBeenCalledWith('a1', 'APPROVED', 'Ship it');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await act(async () => resolve({ ...approval, status: 'APPROVED', canDecide: false, myDecision: 'APPROVED' }));
    expect(await screen.findByText(/Approved · Jia will be notified/)).toBeInTheDocument();
    unmount();
  });

  it('rolls back a failed decision', async () => {
    mocked.decide.mockRejectedValue(new Error('offline'));
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox' });
    fireEvent.click(await screen.findByRole('button', { name: 'Request changes' }));
    await waitFor(() => expect(mocked.decide).toHaveBeenCalledWith('a1', 'CHANGES_REQUESTED', null));
    expect(await screen.findByText(/Your decision wasn’t saved/)).toBeInTheDocument();
    expect(screen.getByText('Waiting on you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    unmount();
  });

  it('shows an empty state per tab', async () => {
    const { unmount } = renderApp(<InboxPage />, { route: '/inbox?tab=assigned' });
    expect(await screen.findByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument();
    expect(screen.getByText(/Tasks people hand to you/)).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledWith('assigned', false);
    unmount();
  });
});
