import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InboxCountsDto, InboxDto, InboxItemDto, InboxQuery } from '@hearth/contracts';
import {
  INBOX_TABS,
  inboxTime,
  notificationIcon,
  type Actor,
  type Clock,
  type InboxTab,
  type NotificationType,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { USER_REF_SELECT, toUserRef } from '../../../shared/mappers/refs';

/** CQRS read side for the inbox list: visible = not archived and not currently snoozed. */
@Injectable()
export class InboxReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private visible(actor: Actor, now: Date): Prisma.NotificationWhereInput {
    return {
      workspaceId: actor.workspaceId,
      recipientId: actor.userId,
      archivedAt: null,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    };
  }

  private tabFilter(tab: InboxTab): Prisma.NotificationWhereInput {
    const types = INBOX_TABS[tab];
    return types ? { type: { in: [...types] } } : {};
  }

  async list(actor: Actor, query: InboxQuery): Promise<InboxDto> {
    const now = this.clock.now();
    const base = this.visible(actor, now);
    const where: Prisma.NotificationWhereInput = {
      AND: [base, this.tabFilter(query.tab), query.unread ? { readAt: null } : {}],
    };
    const [rows, counts, workspace] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        include: { actor: { select: USER_REF_SELECT }, task: { select: { number: true } } },
      }),
      this.counts(actor, now),
      this.prisma.workspace.findUnique({ where: { id: actor.workspaceId }, select: { keyPrefix: true } }),
    ]);
    const prefix = workspace?.keyPrefix ?? 'HRT';
    const items: InboxItemDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actor ? toUserRef(n.actor) : null,
      title: n.title,
      context: n.context,
      excerpt: n.excerpt,
      icon:
        !n.taskId && n.context.startsWith('Docs')
          ? 'doc'
          : notificationIcon(n.type as NotificationType, n.title),
      taskId: n.taskId,
      taskKey: n.task ? `${prefix}-${n.task.number}` : null,
      approvalId: n.approvalId,
      unread: n.readAt === null,
      createdAt: n.createdAt.toISOString(),
      time: inboxTime(n.createdAt, now),
      snoozedUntil: n.snoozedUntil?.toISOString() ?? null,
    }));
    return { items, counts };
  }

  /** Tab counts are unread items ("Mentions 3"); `all` is every visible item. */
  async counts(actor: Actor, now: Date = this.clock.now()): Promise<InboxCountsDto> {
    const base = this.visible(actor, now);
    const grouped = await this.prisma.notification.groupBy({
      by: ['type'],
      where: { AND: [base, { readAt: null }] },
      _count: { _all: true },
    });
    const all = await this.prisma.notification.count({ where: base });
    const unreadOf = (types: readonly string[] | null) =>
      grouped.filter((g) => !types || types.includes(g.type)).reduce((sum, g) => sum + g._count._all, 0);
    return {
      all,
      unread: unreadOf(null),
      mentions: unreadOf(INBOX_TABS.mentions),
      assigned: unreadOf(INBOX_TABS.assigned),
      approvals: unreadOf(INBOX_TABS.approvals),
    };
  }
}
