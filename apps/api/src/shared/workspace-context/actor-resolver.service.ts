import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Actor, Role } from '@hearth/domain';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVITY_THROTTLE_MS = 60_000;

/**
 * Resolves who is acting and in which workspace: the `X-Workspace-Id` header, or the user's
 * first active membership. Guests also get the list of projects they were invited to.
 */
@Injectable()
export class ActorResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, requestedWorkspaceId?: string | null): Promise<Actor> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, ...(requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {}) },
      orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
    });
    if (!membership)
      throw new ForbiddenException('You’re not a member of that workspace. Ask an admin for an invite.');
    if (membership.status === 'DEACTIVATED')
      throw new ForbiddenException(
        'Your access to this workspace was turned off. Contact a workspace admin.',
      );

    if (Date.now() - membership.lastActiveAt.getTime() > ACTIVITY_THROTTLE_MS) {
      // Fire-and-forget: "last active" is a hint, never worth failing a request over.
      void this.prisma.membership
        .update({ where: { id: membership.id }, data: { lastActiveAt: new Date() } })
        .catch(() => undefined);
    }

    const role = membership.role as Role;
    const projectIds =
      role === 'GUEST'
        ? (
            await this.prisma.projectMember.findMany({
              where: { userId, project: { workspaceId: membership.workspaceId } },
              select: { projectId: true },
            })
          ).map((p) => p.projectId)
        : undefined;
    return { userId, workspaceId: membership.workspaceId, role, projectIds };
  }
}
