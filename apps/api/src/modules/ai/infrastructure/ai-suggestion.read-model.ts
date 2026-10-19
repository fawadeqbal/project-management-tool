import { Injectable } from '@nestjs/common';
import type { AiSuggestion } from '@prisma/client';
import type { AiSuggestionDto } from '@hearth/contracts';
import { NotFoundError } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

interface SummaryContent {
  text?: string;
  suggestedNextStep?: string | null;
}
interface BreakdownContent {
  subtasks?: string[];
}

export const toSuggestionDto = (s: AiSuggestion): AiSuggestionDto => {
  const content = (s.content ?? {}) as SummaryContent & BreakdownContent;
  return {
    id: s.id,
    taskId: s.taskId,
    kind: s.kind === 'breakdown' ? 'breakdown' : 'summary',
    status: s.status,
    source: s.source,
    summary: s.kind === 'summary' ? { text: content.text ?? '', suggestedNextStep: content.suggestedNextStep ?? null } : null,
    breakdown: s.kind === 'breakdown' ? { subtasks: content.subtasks ?? [] } : null,
    createdAt: s.createdAt.toISOString(),
  };
};

@Injectable()
export class AiSuggestionReadModel {
  constructor(private readonly prisma: PrismaService) {}

  /** Pending suggestions for a task, newest first, one per kind. */
  async pending(workspaceId: string, taskId: string): Promise<AiSuggestionDto[]> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } });
    if (!task) throw new NotFoundError('Task', taskId);
    const rows = await this.prisma.aiSuggestion.findMany({ where: { taskId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    const seen = new Set<string>();
    return rows.filter((r) => !seen.has(r.kind) && seen.add(r.kind)).map(toSuggestionDto);
  }
}
