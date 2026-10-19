import { diffInDays, formatShortDate, weekdayName } from '../shared/dates';
import type { NotificationType } from './notification-policy';
import type { ApprovalStatus, Decision } from './approval';

/** Context-line icon per notification type (Hearth icon names). */
export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  MENTION: 'comment',
  COMMENT_REPLY: 'comment',
  ASSIGNED: 'my-tasks',
  APPROVAL_REQUESTED: 'status-done',
  STATUS_CHANGED: 'status-progress',
  TASK_COMPLETED: 'status-done',
  DUE_SOON: 'clock',
};

/** The status icon follows the new status when a status change names it ("…to Blocked"). */
export const notificationIcon = (type: NotificationType, title: string): string => {
  if (type !== 'STATUS_CHANGED') return NOTIFICATION_ICON[type];
  const t = title.toLowerCase();
  if (t.endsWith('blocked')) return 'status-blocked';
  if (t.endsWith('in review')) return 'status-review';
  if (t.endsWith('done') || t.includes(' approved ')) return 'status-done';
  if (t.includes('requested changes')) return 'undo';
  if (t.endsWith('to do')) return 'status-todo';
  return NOTIFICATION_ICON[type];
};

/**
 * Inbox timestamps: clock time today ("9:42"), "Yesterday", the weekday within a week
 * ("Mon"), otherwise a short date ("Oct 12"). `offsetMinutes` shifts UTC to the viewer's zone.
 */
export const inboxTime = (at: Date, now: Date, offsetMinutes = 0): string => {
  const shift = (d: Date) => new Date(d.getTime() + offsetMinutes * 60_000);
  const a = shift(at);
  const n = shift(now);
  const days = diffInDays(a, n);
  if (days <= 0) return `${a.getUTCHours()}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekdayName(a);
  return formatShortDate(a);
};

/** "Approval due tomorrow" / "Approval due today" / "Approval overdue by 2 days" / "Approval due Oct 30". */
export const approvalDueLabel = (
  dueDate: Date | null,
  today: Date,
  status: ApprovalStatus,
): { label: string; tone: 'default' | 'warning' | 'danger' } | null => {
  if (status === 'APPROVED') return { label: 'Approved', tone: 'default' };
  if (status === 'CHANGES_REQUESTED') return { label: 'Changes requested', tone: 'default' };
  if (!dueDate) return null;
  const delta = diffInDays(today, dueDate);
  if (delta < 0)
    return { label: `Approval overdue by ${-delta} ${delta === -1 ? 'day' : 'days'}`, tone: 'danger' };
  if (delta === 0) return { label: 'Approval due today', tone: 'warning' };
  if (delta === 1) return { label: 'Approval due tomorrow', tone: 'warning' };
  if (delta < 7) return { label: `Approval due ${weekdayName(dueDate)}`, tone: 'default' };
  return { label: `Approval due ${formatShortDate(dueDate)}`, tone: 'default' };
};

/** Approver row label: "Approved", "Waiting on you", "Waiting", "Changes requested". */
export const approverLabel = (decision: Decision, isMe: boolean): string => {
  if (decision === 'APPROVED') return 'Approved';
  if (decision === 'CHANGES_REQUESTED') return 'Changes requested';
  return isMe ? 'Waiting on you' : 'Waiting';
};

/** "Jia Li asked you and Sara Ahmed to approve" — "you" first when the viewer is an approver. */
export const approvalAskedLine = (
  requesterName: string,
  approvers: { name: string; isMe: boolean }[],
): string => {
  const names = [...approvers]
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    .map((a) => (a.isMe ? 'you' : a.name));
  const list =
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${requesterName} asked ${list} to approve`;
};

/** "1.2 MB", "340 KB" */
export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 ** 2) return `${Math.round((bytes / 1024 ** 2) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};
