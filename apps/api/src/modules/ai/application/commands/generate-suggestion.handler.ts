import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { Prisma } from '@prisma/client';
import type { AiSuggestionDto } from '@hearth/contracts';
import { AI_PROVIDER, createEvent, type AiProvider, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { AiTaskContextLoader } from '../../infrastructure/ai-task-context.loader';
import { AiUsageMeter } from '../../infrastructure/ai-usage.meter';
import { toSuggestionDto } from '../../infrastructure/ai-suggestion.read-model';
import { GenerateSuggestionCommand } from './generate-suggestion.command';

/**
 * Runs the configured AI strategy and stores its output as a suggestion that names its source.
 * Nothing is written to the task here — a person accepts, edits or discards it. One AI credit
 * per generation, checked against the plan limit first.
 */
@CommandHandler(GenerateSuggestionCommand)
export class GenerateSuggestionHandler implements ICommandHandler<
  GenerateSuggestionCommand,
  AiSuggestionDto
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: AiTaskContextLoader,
    private readonly usage: AiUsageMeter,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, taskId, kind }: GenerateSuggestionCommand): Promise<AiSuggestionDto> {
    const task = await this.loader.load(actor.workspaceId, taskId);
    this.access.assert(actor, kind === 'breakdown' ? 'tasks.create' : 'tasks.view', {
      projectId: task.projectId,
    });
    await this.usage.assertAvailable(actor.workspaceId);

    let content: Prisma.InputJsonObject;
    let source: string;
    if (kind === 'summary') {
      const s = await this.ai.summarizeTask(task.context);
      content = { text: s.text, suggestedNextStep: s.suggestedNextStep };
      source = s.source;
    } else {
      const b = await this.ai.breakDownTask(task.context);
      content = { subtasks: b.subtasks };
      source = b.source;
    }
    await this.usage.record(actor.workspaceId);

    const now = this.clock.now();
    // A fresh suggestion replaces any older pending one of the same kind.
    const [, row] = await this.prisma.$transaction([
      this.prisma.aiSuggestion.updateMany({
        where: { taskId, kind, status: 'PENDING' },
        data: { status: 'DISCARDED' },
      }),
      this.prisma.aiSuggestion.create({
        data: { taskId, kind, content, source, createdById: actor.userId, createdAt: now },
      }),
    ]);
    this.events.publish(
      createEvent(
        'ai.suggestion_created',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: row.id, occurredAt: now },
        {
          taskId,
          kind,
          provider: this.ai.name,
        },
      ),
    );
    return toSuggestionDto(row);
  }
}
