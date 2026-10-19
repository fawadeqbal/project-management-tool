import { Module } from '@nestjs/common';
import { APPROVAL_REPOSITORY } from '@hearth/domain';
import { NOTIFICATION_GATEWAY } from './application/ports';
import { NotifyOnDomainEventHandler } from './application/events/notify-on-domain-event.handler';
import { GetInboxHandler } from './application/queries/get-inbox.handler';
import { GetApprovalHandler } from './application/queries/get-approval.handler';
import { TriageNotificationsHandler } from './application/commands/triage-notifications.handler';
import { RequestApprovalHandler } from './application/commands/request-approval.handler';
import { DecideApprovalHandler } from './application/commands/decide-approval.handler';
import { PrismaNotificationGateway } from './infrastructure/prisma-notification.gateway';
import { PrismaApprovalRepository } from './infrastructure/prisma-approval.repository';
import { InboxReadModel } from './infrastructure/inbox.read-model';
import { ApprovalReadModel } from './infrastructure/approval.read-model';
import { InboxController } from './presentation/inbox.controller';

/**
 * Inbox bounded context: notifications created from domain events (Observer), triage
 * (read/unread/archive/snooze) and approvals (Approval aggregate behind a repository port).
 */
@Module({
  controllers: [InboxController],
  providers: [
    { provide: NOTIFICATION_GATEWAY, useClass: PrismaNotificationGateway },
    { provide: APPROVAL_REPOSITORY, useClass: PrismaApprovalRepository },
    InboxReadModel,
    ApprovalReadModel,
    NotifyOnDomainEventHandler,
    GetInboxHandler,
    GetApprovalHandler,
    TriageNotificationsHandler,
    RequestApprovalHandler,
    DecideApprovalHandler,
  ],
})
export class InboxModule {}
