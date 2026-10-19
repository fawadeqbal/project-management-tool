import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { NewNotification, NotificationContext, NotificationGateway } from '../application/ports';

/** Loads who/what/where for an event and writes Notification rows. */
@Injectable()
export class PrismaNotificationGateway implements NotificationGateway {
  constructor(private readonly prisma: PrismaService) {}

  async contextFor(event: DomainEvent): Promise<NotificationContext> {
    const payload = event.payload as Record<string, unknown>;
    const taskId = event.type.startsWith('task.') ? event.aggregateId : typeof payload['taskId'] === 'string' ? (payload['taskId'] as string) : null;
    const [actor, task, workspace] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } }),
      taskId
        ? this.prisma.task.findFirst({
            where: { id: taskId, workspaceId: event.workspaceId },
            select: { number: true, assigneeId: true, project: { select: { name: true } }, followers: { select: { userId: true } } },
          })
        : null,
      this.prisma.workspace.findUnique({ where: { id: event.workspaceId }, select: { keyPrefix: true } }),
    ]);
    const key = task ? `${workspace?.keyPrefix ?? 'HRT'}-${task.number}` : null;
    return {
      actorName: actor?.name ?? 'Someone',
      followerIds: task?.followers.map((f) => f.userId) ?? [],
      taskAssigneeId: task?.assigneeId ?? null,
      context: key ? (task?.project ? `${task.project.name} · ${key}` : key) : null,
    };
  }

  async createMany(notifications: NewNotification[]) {
    if (!notifications.length) return [];
    // Recipients must still belong to the workspace (a removed member never gets new items).
    const members = await this.prisma.membership.findMany({
      where: { workspaceId: notifications[0]!.workspaceId, userId: { in: notifications.map((n) => n.recipientId) }, status: 'ACTIVE' },
      select: { userId: true },
    });
    const allowed = new Set(members.map((m) => m.userId));
    const rows = await this.prisma.$transaction(
      notifications
        .filter((n) => allowed.has(n.recipientId))
        .map((n) =>
          this.prisma.notification.create({
            data: {
              workspaceId: n.workspaceId,
              recipientId: n.recipientId,
              actorId: n.actorId,
              type: n.type,
              taskId: n.taskId || null,
              approvalId: n.approvalId ?? null,
              title: n.title,
              context: n.context,
              excerpt: n.excerpt,
              createdAt: n.createdAt,
            },
            select: { id: true, recipientId: true, type: true, taskId: true },
          }),
        ),
    );
    return rows;
  }
}
