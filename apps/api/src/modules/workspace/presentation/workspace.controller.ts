import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateTagSchema,
  type CreateTagInput,
  type MemberDto,
  type ShellDto,
  type TagDto,
  type TeamDto,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  GetShellQuery,
  ListMembersQuery,
  ListTagsQuery,
  ListTeamsQuery,
} from '../application/workspace.queries';
import { CreateTagCommand } from '../application/create-tag.handler';

@Controller()
export class WorkspaceController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('members')
  members(@CurrentActor() actor: Actor): Promise<MemberDto[]> {
    return this.queries.execute(new ListMembersQuery(actor));
  }

  @Get('teams')
  teams(@CurrentActor() actor: Actor): Promise<TeamDto[]> {
    return this.queries.execute(new ListTeamsQuery(actor));
  }

  @Get('tags')
  tags(@CurrentActor() actor: Actor): Promise<TagDto[]> {
    return this.queries.execute(new ListTagsQuery(actor));
  }

  @Post('tags')
  createTag(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateTagSchema)) input: CreateTagInput,
  ): Promise<TagDto> {
    return this.commands.execute(new CreateTagCommand(actor, input));
  }

  @Get('shell')
  shell(@CurrentActor() actor: Actor): Promise<ShellDto> {
    return this.queries.execute(new GetShellQuery(actor));
  }
}
