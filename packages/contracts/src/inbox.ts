// Contracts for the inbox bounded context: notifications (triage) and approvals.
import { z } from 'zod';
import { DateOnlySchema, IdSchema, type ProjectRefDto, type TaskRefDto, type UserRefDto } from './common';

export const InboxTabSchema = z.enum(['all', 'mentions', 'assigned', 'approvals']);
export type InboxTabDto = z.infer<typeof InboxTabSchema>;

export const NotificationTypeSchema = z.enum(['MENTION', 'ASSIGNED', 'APPROVAL_REQUESTED', 'STATUS_CHANGED', 'COMMENT_REPLY', 'TASK_COMPLETED', 'DUE_SOON']);
export type NotificationTypeDto = z.infer<typeof NotificationTypeSchema>;

const flag = z.preprocess((v) => (v === 'true' || v === '1' || v === true ? true : v === 'false' || v === '0' || v === false ? false : v), z.boolean());

export const InboxQuerySchema = z.object({
  tab: InboxTabSchema.default('all'),
  unread: flag.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type InboxQuery = z.infer<typeof InboxQuerySchema>;

/** One inbox row: who, what and where in one line, with the quoted context below. */
export interface InboxItemDto {
  id: string;
  type: NotificationTypeDto;
  actor: UserRefDto | null;
  /** "Sara Ahmed mentioned you" */
  title: string;
  /** "Website relaunch · HRT-188" */
  context: string;
  excerpt: string | null;
  /** Hearth icon name for the context line ("comment", "status-done", "my-tasks"…). */
  icon: string;
  taskId: string | null;
  taskKey: string | null;
  approvalId: string | null;
  unread: boolean;
  createdAt: string;
  /** "9:42" today, "Yesterday", "Mon", "Oct 12" (server time zone; the web recomputes locally). */
  time: string;
  snoozedUntil: string | null;
}

export interface InboxCountsDto {
  all: number;
  mentions: number;
  assigned: number;
  approvals: number;
  unread: number;
}

export interface InboxDto {
  items: InboxItemDto[];
  counts: InboxCountsDto;
}

export const SnoozePresetSchema = z.enum(['later_today', 'tomorrow', 'next_week']);
export type SnoozePresetDto = z.infer<typeof SnoozePresetSchema>;

export const SnoozeSchema = z
  .object({
    preset: SnoozePresetSchema.optional(),
    until: z.string().datetime({ message: 'Use a date and time like 2026-10-20T09:00:00Z.' }).optional(),
  })
  .refine((v) => !!v.preset !== !!v.until, { message: 'Pick a snooze time: later today, tomorrow, next week or a date.' });
export type SnoozeInput = z.infer<typeof SnoozeSchema>;

export const InboxBulkActionSchema = z.enum(['read', 'unread', 'archive', 'unarchive', 'unsnooze']);
export type InboxBulkAction = z.infer<typeof InboxBulkActionSchema>;

export const InboxBulkSchema = z.object({
  ids: z.array(IdSchema).min(1, 'Select at least one item.').max(200),
  action: InboxBulkActionSchema,
});
export type InboxBulkInput = z.infer<typeof InboxBulkSchema>;

export interface InboxTriageResultDto {
  updated: number;
  /** When items were snoozed: when they come back. */
  snoozedUntil?: string;
}

// ── Approvals ───────────────────────────────────────────────

export const ApprovalDecisionValueSchema = z.enum(['APPROVED', 'CHANGES_REQUESTED']);
export type ApprovalDecisionValue = z.infer<typeof ApprovalDecisionValueSchema>;

export const ApprovalAttachmentInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(['file', 'doc', 'link']).default('file'),
  url: z.string().trim().min(1).max(2000),
  sizeBytes: z.number().int().min(0).max(10 * 1024 ** 3).default(0),
});
export type ApprovalAttachmentInput = z.infer<typeof ApprovalAttachmentInputSchema>;

export const CreateApprovalSchema = z.object({
  title: z.string().trim().min(1, 'Give the request a title.').max(300),
  summary: z.string().trim().max(5000).nullish(),
  dueDate: DateOnlySchema.nullish(),
  approverIds: z.array(IdSchema).min(1, 'Pick at least one approver.').max(20),
  attachments: z.array(ApprovalAttachmentInputSchema).max(20).optional(),
});
export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>;

export const DecideApprovalSchema = z.object({
  decision: ApprovalDecisionValueSchema,
  note: z.string().trim().max(2000).nullish(),
});
export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;

export type ApprovalStatusDto = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export type ApproverDecisionDto = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

export interface ApprovalAttachmentDto {
  id: string;
  name: string;
  kind: string;
  url: string;
  sizeBytes: number;
  /** "Homepage copy v3 · Doc" / "hero-v3.png · 1.2 MB" */
  label: string;
}

export interface ApproverDto {
  user: UserRefDto;
  decision: ApproverDecisionDto;
  /** "Approved" / "Waiting on you" / "Waiting" / "Changes requested" */
  label: string;
  note: string | null;
  decidedAt: string | null;
  isMe: boolean;
}

export interface ApprovalDetailDto {
  id: string;
  title: string;
  summary: string | null;
  status: ApprovalStatusDto;
  task: TaskRefDto;
  project: ProjectRefDto | null;
  /** "Q4 brand campaign · HRT-214" */
  context: string;
  requester: UserRefDto;
  /** "Jia Li asked you and Sara Ahmed to approve" */
  askedLine: string;
  approvedCount: number;
  approverCount: number;
  /** "1 of 2 approvals" */
  progressLabel: string;
  dueDate: string | null;
  /** "Approval due tomorrow" / "Approval overdue by 2 days" / null */
  dueLabel: string | null;
  dueTone: 'default' | 'warning' | 'danger';
  attachments: ApprovalAttachmentDto[];
  approvers: ApproverDto[];
  myDecision: ApproverDecisionDto | null;
  canDecide: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export const INBOX_ROUTES = {
  list: '/inbox',
  read: (id: string) => `/inbox/${id}/read`,
  unread: (id: string) => `/inbox/${id}/unread`,
  archive: (id: string) => `/inbox/${id}/archive`,
  unarchive: (id: string) => `/inbox/${id}/unarchive`,
  snooze: (id: string) => `/inbox/${id}/snooze`,
  unsnooze: (id: string) => `/inbox/${id}/unsnooze`,
  bulk: '/inbox/bulk',
  createApproval: (taskId: string) => `/tasks/${taskId}/approvals`,
  approval: (id: string) => `/approvals/${id}`,
  decide: (id: string) => `/approvals/${id}/decision`,
} as const;
