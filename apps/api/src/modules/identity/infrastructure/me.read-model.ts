import { Injectable } from '@nestjs/common';
import type { MeDto, WorkspaceSummaryDto } from '@hearth/contracts';
import { NotFoundError, ROLE_PERMISSIONS, type Role } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { accent } from '../../../shared/mappers/refs';

/** Read side for "who am I": profile, the current workspace, all workspaces, effective permissions. */
@Injectable()
export class MeReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, workspaceId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { workspace: true }, orderBy: { joinedAt: 'asc' } } },
    });
    if (!user) throw new NotFoundError('User', userId);
    const workspaces: WorkspaceSummaryDto[] = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      keyPrefix: m.workspace.keyPrefix,
      role: m.role,
    }));
    const current = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
    if (!current) throw new NotFoundError('Workspace', workspaceId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        initials: user.initials,
        avatarColor: accent(user.avatarColor, 'blue'),
        jobTitle: user.jobTitle,
        theme: (['light', 'dark', 'system'].includes(user.theme) ? user.theme : 'system') as MeDto['user']['theme'],
      },
      workspace: current,
      workspaces,
      permissions: [...ROLE_PERMISSIONS[current.role as Role]],
    };
  }
}
