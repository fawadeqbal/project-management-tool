import { Inject, Injectable } from '@nestjs/common';
import type { MemberDto, ShellDto, TagDto, TeamDto } from '@hearth/contracts';
import { onboardingProgress, type Actor, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { accent, toProjectRef, toUserRef } from '../../../shared/mappers/refs';

/** Read side of the workspace context: the people directory, teams, tags and the app-shell summary. */
@Injectable()
export class WorkspaceReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async members(actor: Actor): Promise<MemberDto[]> {
    const rows = await this.prisma.membership.findMany({
      where: {
        workspaceId: actor.workspaceId,
        // Guests never see the member list — only people on their projects.
        ...(actor.role === 'GUEST' ? { user: { projectAccess: { some: { projectId: { in: [...(actor.projectIds ?? [])] } } } } } : {}),
      },
      include: { user: { include: { teamMemberships: { include: { team: true } } } } },
      orderBy: [{ status: 'asc' }, { user: { name: 'asc' } }],
    });
    return rows.map((m) => ({
      ...toUserRef(m.user),
      email: m.user.email,
      jobTitle: m.user.jobTitle,
      role: m.role,
      status: m.status,
      lastActiveAt: m.lastActiveAt.toISOString(),
      capacityHoursPerDay: m.capacityHoursPerDay,
      teams: m.user.teamMemberships
        .filter((t) => t.team.workspaceId === actor.workspaceId)
        .map((t) => ({ id: t.team.id, name: t.team.name, color: accent(t.team.color) })),
    }));
  }

  async teams(workspaceId: string): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({ where: { workspaceId }, include: { members: true }, orderBy: { name: 'asc' } });
    return teams.map((t) => ({ id: t.id, name: t.name, color: accent(t.color), memberIds: t.members.map((m) => m.userId) }));
  }

  async tags(workspaceId: string): Promise<TagDto[]> {
    const tags = await this.prisma.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
    return tags.map((t) => ({ id: t.id, name: t.name, color: accent(t.color) }));
  }

  async shell(actor: Actor): Promise<ShellDto> {
    const now = this.clock.now();
    const [favorites, teams, myTasks, inbox, onboarding] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId: actor.userId, project: { workspaceId: actor.workspaceId, archivedAt: null } },
        include: { project: true },
        orderBy: { position: 'asc' },
      }),
      this.teams(actor.workspaceId),
      this.prisma.task.count({ where: { workspaceId: actor.workspaceId, assigneeId: actor.userId, status: { not: 'DONE' }, parentId: null } }),
      this.prisma.notification.count({
        where: {
          workspaceId: actor.workspaceId,
          recipientId: actor.userId,
          readAt: null,
          archivedAt: null,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
        },
      }),
      this.prisma.onboardingProgress.findUnique({ where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: actor.userId } } }),
    ]);
    const progress = onboardingProgress(onboarding?.completedSteps ?? ['create-workspace']);
    return {
      favorites: favorites.map((f) => toProjectRef(f.project)),
      teams,
      counts: { myTasks, inbox },
      onboarding: { completed: progress.completed, total: progress.total, nextStep: progress.nextStep },
    };
  }

  /** Workspace-scoped user refs by id (used by other read models through this module's export). */
  async userRefs(workspaceId: string) {
    const rows = await this.prisma.membership.findMany({ where: { workspaceId }, include: { user: true } });
    return new Map(rows.map((m) => [m.userId, toUserRef(m.user)]));
  }
}
