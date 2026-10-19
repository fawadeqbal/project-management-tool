import type {
  Approval,
  ApprovalRepository,
  DomainEvent,
  NotificationDraft,
  PolicyContext,
} from '@hearth/domain';

/** Everything the notification policy needs to know about an event, loaded by an adapter. */
export interface NotificationContext extends PolicyContext {
  /** "Website relaunch · HRT-188" (null when the event has no task). */
  context: string | null;
}

export interface NewNotification extends NotificationDraft {
  workspaceId: string;
  actorId: string;
  context: string;
  createdAt: Date;
}

/** Port for the notification write side (Prisma adapter in infrastructure, fakes in tests). */
export interface NotificationGateway {
  contextFor(event: DomainEvent): Promise<NotificationContext>;
  createMany(
    notifications: NewNotification[],
  ): Promise<{ id: string; recipientId: string; type: string; taskId: string | null }[]>;
}
export const NOTIFICATION_GATEWAY = Symbol('NotificationGateway');

export interface ApprovalAttachmentDraft {
  name: string;
  kind: string;
  url: string;
  sizeBytes: number;
}

/** The domain repository plus the attachments that travel with a new request. */
export interface InboxApprovalRepository extends ApprovalRepository {
  addAttachments(approvalId: string, attachments: ApprovalAttachmentDraft[]): Promise<void>;
}
export type { Approval };
