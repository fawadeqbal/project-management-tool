import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { AiTaskFilterDto, InterpretResultDto } from '@hearth/contracts';
import {
  PRIORITY_META,
  STATUS_META,
  interpretTaskQuery,
  type Priority,
  type TaskStatus,
} from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { InterpretQueryQuery } from './interpret-query.query';

/**
 * Fast path for ⌘K "Ask Hearth AI": the domain interpreter (no model, no credits) with the
 * workspace's tags, teams, projects and people as vocabulary, mapped to My tasks URL params.
 * Guests only get their own projects as vocabulary.
 */
@QueryHandler(InterpretQueryQuery)
export class InterpretQueryHandler implements IQueryHandler<InterpretQueryQuery, InterpretResultDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ actor, query }: InterpretQueryQuery): Promise<InterpretResultDto> {
    const guest = actor.role === 'GUEST';
    const [tags, teams, projects, people] = await Promise.all([
      this.prisma.tag.findMany({ where: { workspaceId: actor.workspaceId }, select: { name: true } }),
      guest
        ? []
        : this.prisma.team.findMany({
            where: { workspaceId: actor.workspaceId },
            select: { id: true, name: true },
          }),
      this.prisma.project.findMany({
        where: {
          workspaceId: actor.workspaceId,
          archivedAt: null,
          ...(guest ? { id: { in: [...(actor.projectIds ?? [])] } } : {}),
        },
        select: { id: true, name: true },
      }),
      guest
        ? []
        : this.prisma.membership.findMany({
            where: { workspaceId: actor.workspaceId, status: 'ACTIVE' },
            select: { user: { select: { id: true, name: true } } },
          }),
    ]);
    const firstNames = people.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      first: p.user.name.split(' ')[0]!,
    }));
    const result = interpretTaskQuery(query, {
      tags: tags.map((t) => t.name),
      teamsOrProjects: [...teams.map((t) => t.name), ...projects.map((p) => p.name)],
      people: firstNames.map((p) => p.first),
    });

    const filter: AiTaskFilterDto = {};
    const head: string[] = [];
    const tail: string[] = [];
    if (result.overdue) {
      filter.overdue = true;
      head.push('overdue');
    }
    const priority = result.priorities?.[0] as Priority | undefined;
    if (priority) {
      filter.priority = priority;
      head.push(PRIORITY_META[priority].label.toLowerCase());
    }
    const status = result.statuses?.[0] as TaskStatus | undefined;
    if (status) {
      filter.status = status;
      head.push(STATUS_META[status].label.toLowerCase());
    }
    if (result.teamOrProject) {
      const team = teams.find((t) => t.name === result.teamOrProject);
      const project = projects.find((p) => p.name === result.teamOrProject);
      if (team) {
        filter.team = team.id;
        tail.push(`for the ${team.name} team`);
      } else if (project) {
        filter.project = project.id;
        tail.push(`in ${project.name}`);
      }
    }
    if (result.tags?.length) {
      filter.tag = result.tags[0];
      tail.push(`tagged ${result.tags[0]}`);
    }
    if (result.assignee) {
      const person = firstNames.find((p) => p.first === result.assignee);
      if (person) {
        filter.assignee = person.id;
        tail.push(`assigned to ${person.name}`);
      }
    }
    if (result.dueToday) {
      filter.due = 'today';
      tail.push('due today');
    }
    const recognized = Object.keys(filter).length > 0;
    if (result.text) {
      filter.q = result.text;
      if (recognized) tail.push(`matching “${result.text}”`);
    }

    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(filter))
      if (v !== undefined && v !== false) params[k] = v === true ? '1' : String(v);
    const search = new URLSearchParams(params).toString();
    return {
      query,
      recognized,
      filter,
      params,
      explanation: recognized
        ? [`Show ${head.length ? `${head.join(', ')} ` : ''}tasks`, ...tail].join(' ')
        : `Search tasks for “${query.trim()}”`,
      href: `/my-tasks${search ? `?${search}` : ''}`,
    };
  }
}
