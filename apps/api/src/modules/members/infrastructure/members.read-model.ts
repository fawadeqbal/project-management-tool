import { Inject, Injectable } from '@nestjs/common';
import type { AdminMemberDto, InviteDto, MembersOverviewDto, RolesDto } from '@hearth/contracts';
import {
  inviteMeta,
  lastActiveLabel,
  permissionMatrix,
  PLANS,
  ROLE_META,
  ROLES,
  type Actor,
  type Clock,
  type PlanId,
  type Role,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { accent, toUserRef } from '../../../shared/mappers/refs';

const ROLE_ORDER: Record<string, number> = Object.fromEntries(ROLES.map((r, i) => [r, i]));

/** Read side of the Members & roles screen. */
@Injectable()
export class MembersReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(actor: Actor): Promise<MembersOverviewDto> {
    const now = this.clock.now();
    const [rows, pendingInvites, sub] = await Promise.all([
      this.prisma.membership.findMany({
        where: { workspaceId: actor.workspaceId },
        include: {
          user: {
            include: {
              teamMemberships: {
                where: { team: { workspaceId: actor.workspaceId } },
                include: { team: true },
              },
              projectAccess: {
                where: { project: { workspaceId: actor.workspaceId } },
                select: { projectId: true },
              },
            },
          },
        },
      }),
      this.prisma.invite.count({ where: { workspaceId: actor.workspaceId, status: 'PENDING' } }),
      this.prisma.subscription.findUnique({ where: { workspaceId: actor.workspaceId } }),
    ]);

    // Active people first, guests after members, deactivated last (guests visually separated).
    const sortKey = (m: (typeof rows)[number]) =>
      m.status === 'DEACTIVATED' ? 2 : m.role === 'GUEST' ? 1 : 0;
    rows.sort(
      (a, b) =>
        sortKey(a) - sortKey(b) ||
        ROLE_ORDER[a.role]! - ROLE_ORDER[b.role]! ||
        a.user.name.localeCompare(b.user.name),
    );

    const members: AdminMemberDto[] = rows.map((m) => ({
      ...toUserRef(m.user),
      email: m.user.email,
      role: m.role as Role,
      status: m.status,
      isGuest: m.role === 'GUEST',
      guestProjectCount: m.role === 'GUEST' ? m.user.projectAccess.length : null,
      teams: m.user.teamMemberships.map((t) => ({
        id: t.team.id,
        name: t.team.name,
        color: accent(t.team.color),
      })),
      lastActiveAt: m.lastActiveAt.toISOString(),
      lastActiveLabel: lastActiveLabel(
        m.status === 'DEACTIVATED' && m.deactivatedAt ? m.deactivatedAt : m.lastActiveAt,
        now,
      ),
      isYou: m.userId === actor.userId,
    }));

    const planId = (sub?.plan ?? 'FREE') as PlanId;
    const plan = PLANS[planId];
    const active = members.filter((m) => m.status === 'ACTIVE');
    return {
      members,
      counts: {
        members: active.filter((m) => !m.isGuest).length,
        guests: active.filter((m) => m.isGuest).length,
        deactivated: members.length - active.length,
        pendingInvites,
        seatsUsed: active.filter((m) => !m.isGuest).length,
        seatLimit: plan.limits.seats,
      },
      plan: { id: plan.id, name: plan.name },
      identity: {
        sso: 'not_configured',
        scim: 'available_on_enterprise',
        summary: 'SSO: not configured · SCIM: available on Enterprise',
      },
    };
  }

  async invites(actor: Actor): Promise<InviteDto[]> {
    const now = this.clock.now();
    const rows = await this.prisma.invite.findMany({
      where: { workspaceId: actor.workspaceId, status: 'PENDING' },
      include: { team: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => this.toInviteDto(i, now));
  }

  async invite(workspaceId: string, id: string): Promise<InviteDto | null> {
    const i = await this.prisma.invite.findFirst({
      where: { id, workspaceId },
      include: { team: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    });
    return i ? this.toInviteDto(i, this.clock.now()) : null;
  }

  roles(): RolesDto {
    return {
      roles: ROLES.map((role) => ({
        role,
        label: ROLE_META[role].label,
        description: ROLE_META[role].description,
      })),
      matrix: permissionMatrix(),
    };
  }

  private toInviteDto(
    i: {
      id: string;
      email: string;
      role: string;
      createdAt: Date;
      resentAt: Date | null;
      expiresAt: Date;
      team: { id: string; name: string } | null;
      project: { id: string; name: string } | null;
    },
    now: Date,
  ): InviteDto {
    const sentAt = i.resentAt ?? i.createdAt;
    return {
      id: i.id,
      email: i.email,
      role: i.role as Role,
      team: i.team,
      project: i.project,
      meta: inviteMeta(
        {
          role: i.role as Role,
          teamName: i.team?.name,
          projectName: i.project?.name,
          sentAt,
          expiresAt: i.expiresAt,
        },
        now,
      ),
      sentAt: sentAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      expired: i.expiresAt.getTime() <= now.getTime(),
    };
  }
}
