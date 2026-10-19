import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SearchProjectHitDto, SearchPersonHitDto, SearchQuery, SearchResultDto, SearchTaskHitDto } from '@hearth/contracts';
import { diffInDays, fuzzyRank, fuzzyRankWeighted, humanizeDate, startOfDay, type Actor, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { PROJECT_REF_SELECT, USER_REF_SELECT, accent, dateOnly, toProjectRef, toUserRef } from '../../../shared/mappers/refs';

/** Candidate pool per kind before fuzzy ranking: ILIKE narrows, the domain ranker orders. */
const POOL = 200;
/** Below this a match is a scattered subsequence, not something people meant. */
const minScore = (q: string) => q.replace(/\s+/g, '').length * 3;

/**
 * ⌘K server search (CQRS read side). Postgres ILIKE prefilters on each query token (and the
 * task number for "HRT-188" / "188"), then the domain `fuzzyRank` orders the candidates so
 * server and local results rank the same way. Guests only ever see their projects; people
 * search is limited to members who can see the directory.
 */
@Injectable()
export class SearchReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async search(actor: Actor, query: SearchQuery): Promise<SearchResultDto> {
    const started = performance.now();
    const q = query.q.trim();
    const want = (s: SearchQuery['scope']) => query.scope === 'all' || query.scope === s;
    const [tasks, projects, people] = await Promise.all([
      want('tasks') && q ? this.tasks(actor, q, query.limit) : [],
      want('projects') && q ? this.projects(actor, q, query.limit) : [],
      want('people') && q && actor.role !== 'GUEST' ? this.people(actor, q, query.limit) : [],
    ]);
    return { query: q, scope: query.scope, tasks, projects, people, tookMs: Math.max(1, Math.round(performance.now() - started)) };
  }

  private tokens(q: string): string[] {
    return q
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[%_\\]/g, ''))
      .filter((t) => t.length > 0)
      .slice(0, 5);
  }

  private projectScope(actor: Actor): Prisma.ProjectWhereInput {
    return actor.role === 'GUEST' ? { id: { in: [...(actor.projectIds ?? [])] } } : {};
  }

  private async tasks(actor: Actor, q: string, limit: number): Promise<SearchTaskHitDto[]> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: actor.workspaceId }, select: { keyPrefix: true } });
    const prefix = workspace?.keyPrefix ?? 'HRT';
    const numberMatch = q.match(new RegExp(`^(?:${prefix}-?)?(\\d{1,7})$`, 'i'));
    const tokens = this.tokens(q);
    const textMatch: Prisma.TaskWhereInput = {
      AND: tokens.map((t) => ({
        OR: [
          { title: { contains: t, mode: 'insensitive' } },
          { project: { name: { contains: t, mode: 'insensitive' } } },
          { tags: { some: { tag: { name: { contains: t, mode: 'insensitive' } } } } },
        ],
      })),
    };
    // Fuzzy fallback for abbreviations ("prc pg"): first characters of each token as a prefix pool.
    const loose: Prisma.TaskWhereInput = { OR: tokens.map((t) => ({ title: { contains: t.slice(0, 3), mode: 'insensitive' as const } })) };
    const where: Prisma.TaskWhereInput = {
      workspaceId: actor.workspaceId,
      ...(actor.role === 'GUEST' ? { projectId: { in: [...(actor.projectIds ?? [])] } } : {}),
      OR: [textMatch, loose, ...(numberMatch ? [{ number: Number(numberMatch[1]) }] : [])],
    };
    const rows = await this.prisma.task.findMany({
      where,
      take: POOL,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        assignee: { select: USER_REF_SELECT },
        project: { select: PROJECT_REF_SELECT },
        tags: { include: { tag: true } },
      },
    });
    const today = startOfDay(this.clock.now());
    // Title/key hits outrank project/tag-only hits; open work outranks done work at equal relevance.
    const scored = fuzzyRankWeighted(
      q,
      rows,
      {
        primary: (t) => [t.title, `${prefix}-${t.number}`],
        secondary: (t) => [t.project?.name ?? '', ...t.tags.map((x) => x.tag.name)],
        boost: (t) => (t.status === 'DONE' ? -15 : 0) - (t.parentId ? 2 : 0),
      },
      POOL,
    )
      // Scattered subsequence hits ("pric" in "Draft sprint 24 retrospective agenda") are noise.
      .filter((r) => r.match.score >= minScore(q))
      .slice(0, limit);
    return scored.map(({ item: t, match, score }) => ({
      id: t.id,
      key: `${prefix}-${t.number}`,
      number: t.number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: dateOnly(t.dueDate),
      hint: this.dueHint(t.dueDate, t.status === 'DONE', today),
      assignee: t.assignee ? toUserRef(t.assignee) : null,
      project: t.project ? toProjectRef(t.project) : null,
      parentId: t.parentId,
      tags: t.tags.map((x) => ({ id: x.tag.id, name: x.tag.name, color: accent(x.tag.color) })),
      updatedAt: t.updatedAt.toISOString(),
      score: Math.round(score * 10) / 10,
      indices: match.primary && match.field === 0 ? match.indices : [],
    }));
  }

  private dueHint(due: Date | null, done: boolean, today: Date): string | null {
    if (!due) return null;
    if (done) return 'done';
    const delta = diffInDays(today, due);
    if (delta < 0) return `overdue ${-delta} ${delta === -1 ? 'day' : 'days'}`;
    if (delta === 0) return 'due today';
    return `due ${humanizeDate(due, today)}`;
  }

  private async projects(actor: Actor, q: string, limit: number): Promise<SearchProjectHitDto[]> {
    const tokens = this.tokens(q);
    const rows = await this.prisma.project.findMany({
      where: {
        workspaceId: actor.workspaceId,
        archivedAt: null,
        ...this.projectScope(actor),
        OR: tokens.map((t) => ({ name: { contains: t.slice(0, 3), mode: 'insensitive' as const } })),
      },
      take: POOL,
      select: { ...PROJECT_REF_SELECT, _count: { select: { tasks: { where: { status: { not: 'DONE' }, parentId: null } } } } },
    });
    return fuzzyRank(q, rows, (p) => [p.name], POOL).filter((r) => r.match.score >= minScore(q)).slice(0, limit).map(({ item, match }) => ({
      ...toProjectRef(item),
      openTaskCount: item._count.tasks,
      score: Math.round(match.score * 10) / 10,
    }));
  }

  private async people(actor: Actor, q: string, limit: number): Promise<SearchPersonHitDto[]> {
    const tokens = this.tokens(q);
    const rows = await this.prisma.membership.findMany({
      where: {
        workspaceId: actor.workspaceId,
        status: 'ACTIVE',
        user: {
          OR: tokens.flatMap((t) => [
            { name: { contains: t.slice(0, 3), mode: 'insensitive' as const } },
            { email: { contains: t, mode: 'insensitive' as const } },
          ]),
        },
      },
      take: POOL,
      include: { user: { select: { ...USER_REF_SELECT, email: true, jobTitle: true } } },
    });
    return fuzzyRank(q, rows, (m) => [m.user.name, m.user.email, m.user.jobTitle ?? ''], POOL).filter((r) => r.match.score >= minScore(q)).slice(0, limit).map(({ item, match }) => ({
      ...toUserRef(item.user),
      email: item.user.email,
      jobTitle: item.user.jobTitle,
      score: Math.round(match.score * 10) / 10,
    }));
  }
}
