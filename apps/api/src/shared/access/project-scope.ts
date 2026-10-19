import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertCanViewProject,
  canSeeWorkspaceDirectory,
  canViewProject,
  NotFoundError,
  visibleProjectIds,
  type Actor,
} from '@hearth/domain';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The API's single project-scope rule (domain: access/project-scope.ts). Every context asks this
 * service instead of checking `role === 'GUEST'` itself:
 *
 *   - `assertCanViewTask/Project/Sprint` → 404 when the thing is missing *or* hidden from a guest,
 *   - `visibleProjectWhere/visibleTaskWhere` → Prisma filters for read models,
 *   - `canView`, `filterVisibleUsers`, `canSeeDirectory` → for lists and recipients.
 */
@Injectable()
export class ProjectScope {
  constructor(private readonly prisma: PrismaService) {}

  /** Pure check: can the actor see something that lives in `projectId` (null = no project)? */
  canView(actor: Actor, projectId: string | null | undefined): boolean {
    return canViewProject(actor, projectId);
  }

  /** Guests get no people directory, teams or workspace-wide lists. */
  canSeeDirectory(actor: Actor): boolean {
    return canSeeWorkspaceDirectory(actor);
  }

  /** Ids the actor is limited to, or null for "every project in the workspace". */
  projectIds(actor: Actor): readonly string[] | null {
    return visibleProjectIds(actor);
  }

  /** Projects (not archived-filtered) the actor can see in their workspace. */
  visibleProjectWhere(actor: Actor): Prisma.ProjectWhereInput {
    const ids = visibleProjectIds(actor);
    return { workspaceId: actor.workspaceId, ...(ids ? { id: { in: [...ids] } } : {}) };
  }

  /** Tasks the actor can see: their workspace and, for guests, only their projects. */
  visibleTaskWhere(actor: Actor): Prisma.TaskWhereInput {
    const ids = visibleProjectIds(actor);
    return { workspaceId: actor.workspaceId, ...(ids ? { projectId: { in: [...ids] } } : {}) };
  }

  /** Throws a 404 unless the project exists in the actor's workspace and is visible to them. */
  async assertCanViewProject(actor: Actor, projectId: string): Promise<void> {
    assertCanViewProject(actor, projectId, { entity: 'Project', id: projectId });
    const found = await this.prisma.project.count({ where: { id: projectId, workspaceId: actor.workspaceId } });
    if (!found) throw new NotFoundError('Project', projectId);
  }

  /** Throws a 404 unless the task exists in the actor's workspace and is visible; returns its project. */
  async assertCanViewTask(actor: Actor, taskId: string): Promise<{ projectId: string | null }> {
    const row = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId: actor.workspaceId },
      select: { projectId: true },
    });
    if (!row) throw new NotFoundError('Task', taskId);
    assertCanViewProject(actor, row.projectId, { entity: 'Task', id: taskId });
    return row;
  }

  /** Same for a sprint; returns its project. */
  async assertCanViewSprint(actor: Actor, sprintId: string): Promise<{ projectId: string }> {
    const row = await this.prisma.sprint.findFirst({
      where: { id: sprintId, project: { workspaceId: actor.workspaceId } },
      select: { projectId: true },
    });
    if (!row) throw new NotFoundError('Sprint', sprintId);
    assertCanViewProject(actor, row.projectId, { entity: 'Sprint', id: sprintId });
    return row;
  }

  /** In-memory form: throws the 404 for `entity` when `projectId` is hidden from the actor. */
  assertVisible(actor: Actor, projectId: string | null, hidden: { entity: string; id: string }): void {
    assertCanViewProject(actor, projectId, hidden);
  }

  /**
   * Of `userIds`, those who can see something in `projectId` (workspace staff always; guests
   * only when invited to that project). Inactive or unknown members are dropped.
   */
  async filterVisibleUsers(
    workspaceId: string,
    projectId: string | null,
    userIds: readonly string[],
  ): Promise<string[]> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return [];
    const members = await this.prisma.membership.findMany({
      where: { workspaceId, userId: { in: ids }, status: 'ACTIVE' },
      select: { userId: true, role: true },
    });
    const guests = members.filter((m) => m.role === 'GUEST').map((m) => m.userId);
    const invited = new Set(
      projectId && guests.length
        ? (
            await this.prisma.projectMember.findMany({
              where: { projectId, userId: { in: guests } },
              select: { userId: true },
            })
          ).map((p) => p.userId)
        : [],
    );
    const allowed = new Set(
      members.filter((m) => m.role !== 'GUEST' || invited.has(m.userId)).map((m) => m.userId),
    );
    return ids.filter((id) => allowed.has(id));
  }

  /** Whether one user may see `projectId` (see `filterVisibleUsers`). */
  async userCanView(workspaceId: string, projectId: string | null, userId: string): Promise<boolean> {
    return (await this.filterVisibleUsers(workspaceId, projectId, [userId])).length === 1;
  }
}
