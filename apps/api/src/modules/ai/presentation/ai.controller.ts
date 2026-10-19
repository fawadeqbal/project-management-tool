import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  AcceptSuggestionSchema,
  InterpretQuerySchema,
  type AcceptSuggestionInput,
  type AcceptSuggestionResultDto,
  type AiSuggestionDto,
  type InterpretQueryInput,
  type InterpretResultDto,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { GenerateSuggestionCommand } from '../application/commands/generate-suggestion.command';
import { AcceptSuggestionCommand } from '../application/commands/accept-suggestion.command';
import { DiscardSuggestionCommand } from '../application/commands/discard-suggestion.command';
import { ListSuggestionsQuery } from '../application/queries/list-suggestions.query';
import { InterpretQueryQuery } from '../application/queries/interpret-query.query';

@Controller()
export class AiController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post('tasks/:id/ai/summary')
  @RequirePermission('tasks.view')
  summary(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AiSuggestionDto> {
    return this.commands.execute(new GenerateSuggestionCommand(actor, id, 'summary'));
  }

  @Post('tasks/:id/ai/breakdown')
  @RequirePermission('tasks.create')
  breakdown(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AiSuggestionDto> {
    return this.commands.execute(new GenerateSuggestionCommand(actor, id, 'breakdown'));
  }

  @Get('tasks/:id/ai/suggestions')
  @RequirePermission('tasks.view')
  suggestions(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AiSuggestionDto[]> {
    return this.queries.execute(new ListSuggestionsQuery(actor, id));
  }

  @Post('ai/suggestions/:id/accept')
  @HttpCode(200)
  accept(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AcceptSuggestionSchema)) input: AcceptSuggestionInput,
  ): Promise<AcceptSuggestionResultDto> {
    return this.commands.execute(new AcceptSuggestionCommand(actor, id, input.edited));
  }

  @Post('ai/suggestions/:id/discard')
  @HttpCode(200)
  discard(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<AiSuggestionDto> {
    return this.commands.execute(new DiscardSuggestionCommand(actor, id));
  }

  @Post('ai/interpret')
  @HttpCode(200)
  @RequirePermission('tasks.view')
  interpret(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(InterpretQuerySchema)) input: InterpretQueryInput): Promise<InterpretResultDto> {
    return this.queries.execute(new InterpretQueryQuery(actor, input.query));
  }
}
