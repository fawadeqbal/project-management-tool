import { Injectable } from '@nestjs/common';
import { WorkspaceMember, type Role, type WorkspaceMemberRepository } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Adapter: WorkspaceMember aggregate ⇄ the Membership table. */
@Injectable()
export class PrismaWorkspaceMemberRepository implements WorkspaceMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const m = await this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m) return null;
    return WorkspaceMember.restore(m.id, { workspaceId, userId, role: m.role as Role, status: m.status, deactivatedAt: m.deactivatedAt });
  }

  countActiveOwners(workspaceId: string): Promise<number> {
    return this.prisma.membership.count({ where: { workspaceId, role: 'OWNER', status: 'ACTIVE' } });
  }

  async save(member: WorkspaceMember): Promise<void> {
    const s = member.toSnapshot();
    await this.prisma.membership.update({ where: { id: s.id }, data: { role: s.role, status: s.status, deactivatedAt: s.deactivatedAt } });
  }

  /** Permanent removal: unassigns their open tasks and drops team/project access in this workspace. */
  async remove(member: WorkspaceMember): Promise<{ unassignedTasks: number }> {
    const { id, workspaceId, userId } = member.toSnapshot();
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.task.updateMany({ where: { workspaceId, assigneeId: userId, status: { not: 'DONE' } }, data: { assigneeId: null } });
      await tx.teamMember.deleteMany({ where: { userId, team: { workspaceId } } });
      await tx.projectMember.deleteMany({ where: { userId, project: { workspaceId } } });
      await tx.favorite.deleteMany({ where: { userId, project: { workspaceId } } });
      await tx.membership.delete({ where: { id } });
      return { unassignedTasks: count };
    });
  }
}
