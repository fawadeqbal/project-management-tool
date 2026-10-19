import type { INestApplication } from '@nestjs/common';
import type { ApprovalDetailDto, InboxDto, InboxItemDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';

/** Event handlers run asynchronously after the write; poll briefly for their effect. */
async function eventually<T>(fn: () => Promise<T | undefined | null | false>, timeoutMs = 3000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for the event handler');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('Inbox & approvals (e2e)', () => {
  let app: INestApplication;
  let fawad: UserClient;
  let sara: UserClient;
  let jia: UserClient;
  let mo: UserClient;

  const inbox = async (who: UserClient, query = '') =>
    (await who.get(`/inbox${query}`).expect(200)).body as InboxDto;

  beforeAll(async () => {
    app = await createTestApp();
    [fawad, sara, jia, mo] = await Promise.all([
      asUser(app),
      asUser(app, 'sara@acme.com'),
      asUser(app, 'jia@acme.com'),
      asUser(app, 'mo@acme.com'),
    ]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('shows the seeded inbox like the design, newest first, with tab counts', async () => {
    const body = await inbox(fawad);
    expect(body.items.slice(0, 3).map((i) => [i.title, i.unread])).toEqual([
      ['Jia Li requested your approval', true],
      ['Sara Ahmed mentioned you', true],
      ['Mo Khan assigned you a task', true],
    ]);
    expect(body.items[1]).toMatchObject({
      type: 'MENTION',
      context: 'Website relaunch · HRT-188',
      taskKey: 'HRT-188',
      icon: 'comment',
    });
    expect(body.items[1]!.actor).toMatchObject({ name: 'Sara Ahmed', initials: 'SA' });
    expect(body.items[0]!.approvalId).toBeTruthy();
    expect(body.items.find((i) => i.title.includes('changed status'))).toMatchObject({
      icon: 'status-blocked',
      time: 'Yesterday',
      unread: false,
    });
    expect(body.counts).toMatchObject({ all: 7, mentions: 1, assigned: 1, approvals: 1, unread: 3 });

    const approvals = await inbox(fawad, '?tab=approvals');
    expect(approvals.items.map((i) => i.type)).toEqual(['APPROVAL_REQUESTED']);
    const unread = await inbox(fawad, '?unread=true');
    expect(unread.items).toHaveLength(3);
  });

  it('notifies Fawad when Sara @mentions him on HRT-188', async () => {
    const task = (await fawad.get('/tasks/key/HRT-188').expect(200)).body as { id: string };
    await sara
      .post(`/tasks/${task.id}/comments`, { body: '@Fawad the toggle passes 4.6:1 now — good to ship?' })
      .expect(201);
    const mention = await eventually(async () =>
      (await inbox(fawad, '?tab=mentions')).items.find((i) => i.excerpt?.includes('4.6:1')),
    );
    expect(mention).toMatchObject({
      type: 'MENTION',
      title: 'Sara Ahmed mentioned you',
      context: 'Website relaunch · HRT-188',
      unread: true,
      taskKey: 'HRT-188',
    });
    expect((await inbox(fawad)).counts.mentions).toBe(2);
    // Sara doesn't notify herself
    expect((await inbox(sara)).items.some((i) => i.excerpt?.includes('4.6:1'))).toBe(false);
  });

  it('marks read/unread and keeps counts in step', async () => {
    const first = (await inbox(fawad, '?tab=assigned')).items[0]!;
    await fawad.post(`/inbox/${first.id}/read`).expect(200);
    expect((await inbox(fawad)).counts.assigned).toBe(0);
    await fawad.post(`/inbox/${first.id}/unread`).expect(200);
    expect((await inbox(fawad)).counts.assigned).toBe(1);
  });

  it('archives and unarchives (undo)', async () => {
    const item = (await inbox(fawad)).items.find((i) => i.title.startsWith('Ravi'))!;
    await fawad.post(`/inbox/${item.id}/archive`).expect(200);
    expect((await inbox(fawad)).items.some((i) => i.id === item.id)).toBe(false);
    await fawad.post(`/inbox/${item.id}/unarchive`).expect(200);
    expect((await inbox(fawad)).items.some((i) => i.id === item.id)).toBe(true);
  });

  it('snoozes items until the chosen time', async () => {
    const item = (await inbox(fawad)).items.find((i) => i.title.startsWith('Nadia'))!;
    const res = await fawad.post(`/inbox/${item.id}/snooze`, { preset: 'tomorrow' }).expect(200);
    expect(new Date(res.body.snoozedUntil).getTime()).toBeGreaterThan(Date.now());
    expect((await inbox(fawad)).items.some((i) => i.id === item.id)).toBe(false);
    await fawad.post(`/inbox/${item.id}/unsnooze`).expect(200);
    expect((await inbox(fawad)).items.some((i) => i.id === item.id)).toBe(true);
    // A snooze that already ended brings it back.
    await fawad
      .post(`/inbox/${item.id}/snooze`, { until: new Date(Date.now() - 60_000).toISOString() })
      .expect(400);
    await fawad
      .post(`/inbox/${item.id}/snooze`, { until: new Date(Date.now() + 1500).toISOString() })
      .expect(200);
    await new Promise((r) => setTimeout(r, 1700));
    expect((await inbox(fawad)).items.some((i) => i.id === item.id)).toBe(true);
    await fawad.post(`/inbox/${item.id}/snooze`, {}).expect(400);
  });

  it('applies bulk actions only to my own items', async () => {
    const mine = (await inbox(fawad)).items.slice(0, 2).map((i) => i.id);
    const saras = (await inbox(sara)).items[0]!.id;
    const res = await fawad.post('/inbox/bulk', { ids: [...mine, saras], action: 'read' }).expect(200);
    expect(res.body.updated).toBeLessThanOrEqual(2);
    expect((await inbox(sara)).items.find((i) => i.id === saras)).toBeTruthy();
    await fawad.post(`/inbox/${saras}/archive`).expect(404);
    await fawad.post('/inbox/bulk', { ids: mine, action: 'unread' }).expect(200);
  });

  it('shows the approval detail from Fawad’s point of view', async () => {
    const item = (await inbox(fawad, '?tab=approvals')).items[0]!;
    const detail = (await fawad.get(`/approvals/${item.approvalId}`).expect(200)).body as ApprovalDetailDto;
    expect(detail).toMatchObject({
      title: 'Homepage copy v3 — ready for approval',
      status: 'PENDING',
      askedLine: 'Jia Li asked you and Sara Ahmed to approve',
      progressLabel: '1 of 2 approvals',
      dueLabel: 'Approval due tomorrow',
      dueTone: 'warning',
      myDecision: 'PENDING',
      canDecide: true,
    });
    expect(detail.context).toMatch(/^Q4 brand campaign · HRT-\d+$/);
    expect(detail.approvers.map((a) => [a.user.name, a.label])).toEqual([
      ['Sara Ahmed', 'Approved'],
      ['Fawad Iqbal', 'Waiting on you'],
    ]);
    expect(detail.attachments.map((a) => a.label)).toEqual([
      'Homepage copy v3 · Doc',
      'hero-v3.png · 1.2 MB',
    ]);
  });

  it('lets only approvers decide, resolves to APPROVED and notifies Jia', async () => {
    const item = (await inbox(fawad, '?tab=approvals')).items[0]!;
    const forbidden = await mo
      .post(`/approvals/${item.approvalId}/decision`, { decision: 'APPROVED' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('approval.not_approver');

    const res = await fawad
      .post(`/approvals/${item.approvalId}/decision`, { decision: 'APPROVED', note: 'Ship it' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'APPROVED',
      progressLabel: '2 of 2 approvals',
      canDecide: false,
      myDecision: 'APPROVED',
    });

    const notice = await eventually(async () =>
      (await inbox(jia)).items.find((i: InboxItemDto) => i.title === 'Fawad Iqbal approved your request'),
    );
    expect(notice).toMatchObject({ approvalId: item.approvalId, unread: true });
    await fawad.post(`/approvals/${item.approvalId}/decision`, { decision: 'CHANGES_REQUESTED' }).expect(422);
  });

  it('requests a new approval and notifies the approvers', async () => {
    const task = (await jia.get('/tasks/key/HRT-182').expect(200)).body as { id: string };
    const members = (await jia.get('/members').expect(200)).body as { id: string; email: string }[];
    const saraId = members.find((m) => m.email === 'sara@acme.com')!.id;
    const res = await jia
      .post(`/tasks/${task.id}/approvals`, {
        title: 'Final plan names',
        summary: 'Starter, Team, Business.',
        approverIds: [saraId],
        attachments: [
          { name: 'names.pdf', kind: 'file', url: 'https://files.acme.com/names.pdf', sizeBytes: 2048 },
        ],
      })
      .expect(201);
    expect(res.body).toMatchObject({
      title: 'Final plan names',
      progressLabel: '0 of 1 approval',
      askedLine: 'Jia Li asked Sara Ahmed to approve',
      canDecide: false,
    });
    const notice = await eventually(async () =>
      (await inbox(sara, '?tab=approvals')).items.find((i) => i.approvalId === res.body.id),
    );
    expect(notice.title).toBe('Jia Li requested your approval');
    await jia.post(`/tasks/${task.id}/approvals`, { title: 'x', approverIds: [] }).expect(400);
  });
});
