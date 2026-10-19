import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isAccentColor, parseWipLimits, Project, type ProjectRepository } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const WITH_SECTIONS = { sections: { orderBy: { position: 'asc' } } } satisfies Prisma.ProjectInclude;
type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof WITH_SECTIONS }>;

/** Adapter: persists the Project aggregate (and its section ordering) with Prisma. */
@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  nextId(): string {
    return `prj_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }

  nextSectionId(): string {
    return `sec_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }

  async findById(workspaceId: string, id: string): Promise<Project | null> {
    const row = await this.prisma.project.findFirst({
      where: { id, workspaceId, archivedAt: null },
      include: WITH_SECTIONS,
    });
    return row ? toAggregate(row) : null;
  }

  async findBySectionId(workspaceId: string, sectionId: string): Promise<Project | null> {
    const row = await this.prisma.project.findFirst({
      where: { workspaceId, archivedAt: null, sections: { some: { id: sectionId } } },
      include: WITH_SECTIONS,
    });
    return row ? toAggregate(row) : null;
  }

  async save(project: Project): Promise<void> {
    const s = project.toSnapshot();
    const data = {
      name: s.name,
      description: s.description,
      color: s.color,
      icon: s.icon,
      health: s.health,
      startDate: s.startDate,
      dueDate: s.dueDate,
      wipLimits: s.wipLimits as Prisma.InputJsonValue,
      teamId: s.teamId,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.project.upsert({
        where: { id: s.id },
        create: { id: s.id, workspaceId: s.workspaceId, ownerId: s.ownerId, ...data },
        update: data,
      });
      const keep = s.sections.map((x) => x.id);
      await tx.section.deleteMany({ where: { projectId: s.id, id: { notIn: keep } } });
      for (const section of s.sections) {
        await tx.section.upsert({
          where: { id: section.id },
          create: { id: section.id, projectId: s.id, name: section.name, position: section.position },
          update: { name: section.name, position: section.position },
        });
      }
    });
  }
}

const toAggregate = (row: ProjectRow): Project =>
  Project.restore(row.id, {
    workspaceId: row.workspaceId,
    ownerId: row.ownerId,
    teamId: row.teamId,
    name: row.name,
    description: row.description,
    color: isAccentColor(row.color) ? row.color : 'blue',
    icon: row.icon,
    health: row.health,
    startDate: row.startDate,
    dueDate: row.dueDate,
    wipLimits: parseWipLimits(row.wipLimits),
    sections: row.sections.map((s) => ({ id: s.id, name: s.name, position: s.position })),
  });
