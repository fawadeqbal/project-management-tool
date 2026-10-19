import type { DomainEvent } from '../shared/domain-event';
import { STATUS_META, type TaskStatus } from '../task/values';

export const NOTIFICATION_TYPES = ['MENTION', 'ASSIGNED', 'APPROVAL_REQUESTED', 'STATUS_CHANGED', 'COMMENT_REPLY', 'TASK_COMPLETED', 'DUE_SOON'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Inbox tabs: the three kinds of “needs me”, plus All. */
export const INBOX_TABS = {
  all: null,
  mentions: ['MENTION', 'COMMENT_REPLY'],
  assigned: ['ASSIGNED'],
  approvals: ['APPROVAL_REQUESTED'],
} as const satisfies Record<string, readonly NotificationType[] | null>;
export type InboxTab = keyof typeof INBOX_TABS;

export interface NotificationDraft {
  recipientId: string;
  type: NotificationType;
  /** "Sara Ahmed mentioned you" */
  title: string;
  excerpt: string | null;
  taskId: string | null;
  approvalId?: string | null;
}

export interface PolicyContext {
  actorName: string;
  /** Users following the task (creator, assignee, commenters, explicit followers). */
  followerIds: readonly string[];
  taskAssigneeId: string | null;
}

/**
 * Decides who hears about what. Rules: never notify the actor about their own action; one
 * notification per person per event, picking the most specific reason (mention beats reply
 * beats status change).
 */
export const notificationsFor = (event: DomainEvent, ctx: PolicyContext): NotificationDraft[] => {
  const p = event.payload as Record<string, unknown>;
  const drafts = new Map<string, NotificationDraft>();
  const add = (recipientId: string | null | undefined, d: Omit<NotificationDraft, 'recipientId'>) => {
    if (!recipientId || recipientId === event.actorId || drafts.has(recipientId)) return;
    drafts.set(recipientId, { recipientId, ...d });
  };
  const taskId = event.aggregateId;

  switch (event.type) {
    case 'task.assigned':
      add(p['to'] as string | null, { type: 'ASSIGNED', title: `${ctx.actorName} assigned you a task`, excerpt: String(p['title'] ?? ''), taskId });
      break;
    case 'task.status_changed': {
      const to = p['to'] as TaskStatus;
      const done = to === 'DONE';
      for (const f of ctx.followerIds)
        add(f, {
          type: done ? 'TASK_COMPLETED' : 'STATUS_CHANGED',
          title: done ? `${ctx.actorName} completed a task you follow` : `${ctx.actorName} changed status to ${STATUS_META[to].label}`,
          excerpt: String(p['title'] ?? ''),
          taskId,
        });
      break;
    }
    case 'comment.created': {
      const excerpt = String(p['excerpt'] ?? '');
      const commentTaskId = String(p['taskId'] ?? taskId);
      for (const m of (p['mentionedUserIds'] as string[] | undefined) ?? [])
        add(m, { type: 'MENTION', title: `${ctx.actorName} mentioned you`, excerpt, taskId: commentTaskId });
      add(p['parentAuthorId'] as string | null, { type: 'COMMENT_REPLY', title: `${ctx.actorName} replied in a thread`, excerpt, taskId: commentTaskId });
      add(ctx.taskAssigneeId, { type: 'COMMENT_REPLY', title: `${ctx.actorName} commented on your task`, excerpt, taskId: commentTaskId });
      break;
    }
    case 'approval.requested':
      for (const a of (p['approverIds'] as string[] | undefined) ?? [])
        add(a, {
          type: 'APPROVAL_REQUESTED',
          title: `${ctx.actorName} requested your approval`,
          excerpt: String(p['title'] ?? ''),
          taskId: String(p['taskId'] ?? ''),
          approvalId: event.aggregateId,
        });
      break;
    default:
      break;
  }
  return [...drafts.values()];
};

/** Snooze presets — items return at the chosen time. */
export const snoozeUntil = (preset: 'later_today' | 'tomorrow' | 'next_week', now: Date): Date => {
  const d = new Date(now);
  if (preset === 'later_today') return new Date(now.getTime() + 3 * 3_600_000);
  if (preset === 'tomorrow') {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(9, 0, 0, 0);
    return d;
  }
  const delta = ((1 - d.getUTCDay() + 7) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  d.setUTCHours(9, 0, 0, 0);
  return d;
};
