import { describe, expect, it } from 'vitest';
import { approvalAskedLine, approvalDueLabel, approverLabel, formatFileSize, inboxTime, notificationIcon } from './inbox-presentation';
import { notificationsFor } from './notification-policy';
import { createEvent } from '../shared/domain-event';

const now = new Date('2026-10-19T12:00:00Z'); // a Monday

describe('inbox presentation', () => {
  it('formats inbox times like the design', () => {
    expect(inboxTime(new Date('2026-10-19T09:42:00Z'), now)).toBe('9:42');
    expect(inboxTime(new Date('2026-10-18T16:00:00Z'), now)).toBe('Yesterday');
    expect(inboxTime(new Date('2026-10-15T16:00:00Z'), now)).toBe('Thu');
    expect(inboxTime(new Date('2026-10-01T16:00:00Z'), now)).toBe('Oct 1');
  });

  it('labels approval due dates', () => {
    const today = new Date('2026-10-19T00:00:00Z');
    expect(approvalDueLabel(new Date('2026-10-20T00:00:00Z'), today, 'PENDING')).toEqual({ label: 'Approval due tomorrow', tone: 'warning' });
    expect(approvalDueLabel(new Date('2026-10-17T00:00:00Z'), today, 'PENDING')).toEqual({ label: 'Approval overdue by 2 days', tone: 'danger' });
    expect(approvalDueLabel(null, today, 'PENDING')).toBeNull();
    expect(approvalDueLabel(null, today, 'APPROVED')?.label).toBe('Approved');
  });

  it('names approvers with "you" first', () => {
    expect(approvalAskedLine('Jia Li', [{ name: 'Sara Ahmed', isMe: false }, { name: 'Fawad Iqbal', isMe: true }])).toBe('Jia Li asked you and Sara Ahmed to approve');
    expect(approverLabel('PENDING', true)).toBe('Waiting on you');
    expect(approverLabel('APPROVED', false)).toBe('Approved');
  });

  it('picks icons and sizes', () => {
    expect(notificationIcon('STATUS_CHANGED', 'Nadia Bashir changed status to Blocked')).toBe('status-blocked');
    expect(notificationIcon('MENTION', 'x')).toBe('comment');
    expect(formatFileSize(1.2 * 1024 ** 2)).toBe('1.2 MB');
  });

  it('tells the requester about a decision', () => {
    const e = createEvent('approval.decided', { workspaceId: 'w', actorId: 'fawad', aggregateId: 'a1', occurredAt: now }, {
      taskId: 't', decision: 'APPROVED', status: 'APPROVED', requesterId: 'jia', title: 'Homepage copy v3',
    });
    expect(notificationsFor(e, { actorName: 'Fawad Iqbal', followerIds: [], taskAssigneeId: null })).toEqual([
      { recipientId: 'jia', type: 'STATUS_CHANGED', title: 'Fawad Iqbal approved your request', excerpt: 'Homepage copy v3', taskId: 't', approvalId: 'a1' },
    ]);
  });
});
