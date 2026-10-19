import { Injectable } from '@nestjs/common';
import { addDays, type ProjectTemplate } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreatedFromTemplate {
  project: { id: string; name: string; color: string; teamId: string | null };
  tasks: { id: string; number: number; title: string; assigneeId: string | null }[];
  keyPrefix: string;
}

/**
 * Writes a project, its sections and starter tasks in one transaction. Task numbers come from
 * the workspace sequence (atomic increment), like every other task. The first task is assigned
 * to the person applying the template so My tasks isn't empty.
 */
@Injectable()
export class TemplateProjectWriter {
  constructor(private readonly prisma: PrismaService) {}

  create(input: { workspaceId: string; ownerId: string; name: string; template: ProjectTemplate; today: Date; now: Date }): Promise<CreatedFromTemplate> {
    const { workspaceId, ownerId, template, today, now } = input;
    const lastDue = Math.max(0, ...template.tasks.map((t) => t.dueInDays ?? 0));
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          ownerId,
          name: input.name,
          description: `${template.name} template — ${template.description}.`,
          color: template.color,
          icon: template.icon,
          startDate: today,
          dueDate: lastDue ? addDays(today, lastDue) : null,
          createdAt: now,
        },
      });
      const sections = await Promise.all(
        template.sections.map((name, position) => tx.section.create({ data: { projectId: project.id, name, position } })),
      );
      const sectionId = (name: string) => sections.find((s) => s.name === name)?.id ?? null;
      const ws = await tx.workspace.update({ where: { id: workspaceId }, data: { taskSeq: { increment: template.tasks.length } }, select: { taskSeq: true, keyPrefix: true } });
      const firstNumber = ws.taskSeq - template.tasks.length + 1;
      const tasks: CreatedFromTemplate['tasks'] = [];
      for (const [i, t] of template.tasks.entries()) {
        const assigneeId = i === 0 ? ownerId : null;
        const task = await tx.task.create({
          data: {
            workspaceId,
            projectId: project.id,
            sectionId: sectionId(t.section),
            number: firstNumber + i,
            title: t.title,
            priority: t.priority ?? 'NONE',
            creatorId: ownerId,
            assigneeId,
            dueDate: t.dueInDays !== undefined ? addDays(today, t.dueInDays) : null,
            listPosition: i + 1,
            boardPosition: i + 1,
            createdAt: now,
          },
          select: { id: true, number: true, title: true, assigneeId: true },
        });
        tasks.push(task);
      }
      const favorites = await tx.favorite.count({ where: { userId: ownerId } });
      await tx.favorite.create({ data: { userId: ownerId, projectId: project.id, position: favorites } });
      return { project: { id: project.id, name: project.name, color: project.color, teamId: project.teamId }, tasks, keyPrefix: ws.keyPrefix };
    });
  }
}
