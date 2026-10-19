import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AiSuggestionDto } from '@hearth/contracts';
import { NotFoundError } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { AccessService } from '../../../../shared/access/access.service';
import { toSuggestionDto } from '../../infrastructure/ai-suggestion.read-model';
import { DiscardSuggestionCommand } from './discard-suggestion.command';

/** Discards a pending suggestion. Idempotent: discarding twice is fine. */
@CommandHandler(DiscardSuggestionCommand)
export class DiscardSuggestionHandler implements ICommandHandler<DiscardSuggestionCommand, AiSuggestionDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async execute({ actor, suggestionId }: DiscardSuggestionCommand): Promise<AiSuggestionDto> {
    const s = await this.prisma.aiSuggestion.findFirst({
      where: { id: suggestionId, task: { workspaceId: actor.workspaceId } },
      include: { task: { select: { projectId: true } } },
    });
    if (!s) throw new NotFoundError('Suggestion', suggestionId);
    this.access.assert(actor, 'tasks.view', { projectId: s.task.projectId });
    if (s.status !== 'PENDING') return toSuggestionDto(s);
    return toSuggestionDto(await this.prisma.aiSuggestion.update({ where: { id: s.id }, data: { status: 'DISCARDED' } }));
  }
}
