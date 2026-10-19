import { describe, expect, it } from 'vitest';
import { notificationsFor, snoozeUntil } from './notification-policy';
import { Approval, assertSafeAttachmentUrl } from './approval';
import { createEvent } from '../shared/domain-event';

const now = new Date('2026-10-19T09:42:00Z');
const base = { workspaceId: 'w', actorId: 'sara', aggregateId: 'task-188', occurredAt: now };

describe('notification policy', () => {
  it('notifies mentioned people once and never the actor', () => {
    const e = createEvent('comment.created', base, {
      taskId: 'task-188',
      excerpt: '@Fawad the toggle is 3.9:1',
      mentionedUserIds: ['fawad', 'sara'],
      parentAuthorId: 'fawad',
    });
    const drafts = notificationsFor(e, { actorName: 'Sara Ahmed', followerIds: [], taskAssigneeId: 'fawad' });
    expect(drafts).toEqual([
      {
        recipientId: 'fawad',
        type: 'MENTION',
        title: 'Sara Ahmed mentioned you',
        excerpt: '@Fawad the toggle is 3.9:1',
        taskId: 'task-188',
      },
    ]);
  });

  it('tells followers when a task they follow is completed', () => {
    const e = createEvent('task.status_changed', base, {
      title: 'Accessibility pass',
      from: 'IN_REVIEW',
      to: 'DONE',
    });
    const drafts = notificationsFor(e, {
      actorName: 'Sara Ahmed',
      followerIds: ['fawad', 'sara'],
      taskAssigneeId: null,
    });
    expect(drafts.map((d) => [d.recipientId, d.type, d.title])).toEqual([
      ['fawad', 'TASK_COMPLETED', 'Sara Ahmed completed a task you follow'],
    ]);
  });

  it('snoozes until tomorrow morning', () => {
    expect(snoozeUntil('tomorrow', now).toISOString()).toBe('2026-10-20T09:00:00.000Z');
  });
});

describe('approval', () => {
  const request = () =>
    Approval.request(
      {
        id: 'a1',
        workspaceId: 'w',
        taskId: 't',
        requesterId: 'jia',
        title: 'Homepage copy v3',
        approverIds: ['sara', 'fawad'],
      },
      now,
    );

  it('is approved once everyone approves', () => {
    const a = request();
    a.decide('sara', 'APPROVED', null, now);
    expect(a.status).toBe('PENDING');
    expect(a.approvedCount).toBe(1);
    a.decide('fawad', 'APPROVED', 'Ship it', now);
    expect(a.status).toBe('APPROVED');
  });

  it('resolves as changes requested when anyone asks for changes', () => {
    const a = request();
    a.decide('fawad', 'CHANGES_REQUESTED', 'Tighten the hero', now);
    expect(a.status).toBe('CHANGES_REQUESTED');
    expect(() => a.decide('sara', 'APPROVED', null, now)).toThrow(/already resolved/);
  });

  it('only approvers can decide', () => {
    expect(() => request().decide('mo', 'APPROVED', null, now)).toThrow(/not an approver/);
  });
});

describe('approval attachments', () => {
  it('accepts only http(s) links', () => {
    expect(() => assertSafeAttachmentUrl('https://files.acme.com/names.pdf')).not.toThrow();
    expect(() => assertSafeAttachmentUrl('http://intranet.acme.com/x')).not.toThrow();
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'file:///etc/passwd',
      '//evil.example/x',
      'https://',
      'hearth.pdf',
    ])
      expect(() => assertSafeAttachmentUrl(bad), bad).toThrow(/https:\/\//);
  });
});
