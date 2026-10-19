import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { MemberHandle, MissingReference, ProjectHandle, TaskDirectory, TaskReferences } from '../application/ports';

/** Prisma adapter for the TaskDirectory port: people, projects and workspace reference checks. */
@Injectable()
export class PrismaTaskDirectory implements TaskDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async activeMembers(workspaceId: string): Promise<MemberHandle[]> {
    const rows = await this.prisma.membership.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { user: { select: { id: true, name: true, initials: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => r.user);
  }

  async projects(workspaceId: string, onlyIds?: readonly string[]): Promise<ProjectHandle[]> {
    return this.prisma.project.findMany({
      where: { workspaceId, archivedAt: null, ...(onlyIds ? { id: { in: [...onlyIds] } } : {}) },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMissingReference(workspaceId: string, refs: TaskReferences): Promise<MissingReference | null> {
    const checks: Array<Promise<MissingReference | null>> = [];
    const check = (entity: MissingReference['entity'], id: string, exists: Promise<number>) =>
      checks.push(exists.then((n) => (n > 0 ? null : { entity, id })));

    if (refs.projectId) check('Project', refs.projectId, this.prisma.project.count({ where: { id: refs.projectId, workspaceId } }));
    if (refs.sectionId) check('Section', refs.sectionId, this.prisma.section.count({ where: { id: refs.sectionId, project: { workspaceId } } }));
    if (refs.parentId) check('Task', refs.parentId, this.prisma.task.count({ where: { id: refs.parentId, workspaceId } }));
    if (refs.sprintId) check('Sprint', refs.sprintId, this.prisma.sprint.count({ where: { id: refs.sprintId, project: { workspaceId } } }));
    if (refs.assigneeId)
      check('Member', refs.assigneeId, this.prisma.membership.count({ where: { workspaceId, userId: refs.assigneeId, status: 'ACTIVE' } }));
    if (refs.tagIds?.length) {
      const ids = [...new Set(refs.tagIds)];
      checks.push(
        this.prisma.tag.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }).then((found) => {
          const known = new Set(found.map((t) => t.id));
          const missing = ids.find((id) => !known.has(id));
          return missing ? { entity: 'Tag' as const, id: missing } : null;
        }),
      );
    }
    const results = await Promise.all(checks);
    return results.find((r) => r !== null) ?? null;
  }

  async projectOfTask(workspaceId: string, taskId: string): Promise<string | null | undefined> {
    const row = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId }, select: { projectId: true } });
    return row ? row.projectId : undefined;
  }
}
