import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceExportDto } from '@hearth/contracts';
import type { Actor, Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { dateOnly } from '../../../shared/mappers/refs';

/** A portable JSON snapshot of the workspace's projects and tasks. */
@Injectable()
export class WorkspaceExportReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async export(actor: Actor): Promise<WorkspaceExportDto> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: { id: true, name: true, keyPrefix: true },
    });
    const [projects, tasks] = await Promise.all([
      this.prisma.project.findMany({
        where: { workspaceId: actor.workspaceId },
        include: { sections: { orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { workspaceId: actor.workspaceId },
        include: {
          project: { select: { name: true } },
          section: { select: { name: true } },
          assignee: { select: { email: true } },
        },
        orderBy: { number: 'asc' },
      }),
    ]);
    return {
      exportedAt: this.clock.now().toISOString(),
      workspace: { id: workspace.id, name: workspace.name },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        sections: p.sections.map((s) => s.name),
        startDate: dateOnly(p.startDate),
        dueDate: dateOnly(p.dueDate),
      })),
      tasks: tasks.map((t) => ({
        key: `${workspace.keyPrefix}-${t.number}`,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        project: t.project?.name ?? null,
        section: t.section?.name ?? null,
        assignee: t.assignee?.email ?? null,
        startDate: dateOnly(t.startDate),
        dueDate: dateOnly(t.dueDate),
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }
}
