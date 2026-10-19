import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateMilestoneSchema,
  CreateProjectSchema,
  CreateSectionSchema,
  UpdateMilestoneSchema,
  UpdateProjectSchema,
  UpdateSectionSchema,
  type BoardDto,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type CreateSectionInput,
  type MilestoneDto,
  type ProjectDetailDto,
  type ProjectSummaryDto,
  type SectionDto,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
  type UpdateSectionInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { RequirePermission } from '../../../shared/access/require-permission';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { CreateProjectCommand } from '../application/commands/create-project.handler';
import { UpdateProjectCommand } from '../application/commands/update-project.handler';
import { SetFavoriteCommand } from '../application/commands/favorite-project.handler';
import { CreateSectionCommand } from '../application/commands/create-section.handler';
import { UpdateSectionCommand } from '../application/commands/update-section.handler';
import { DeleteSectionCommand } from '../application/commands/delete-section.handler';
import { CreateMilestoneCommand } from '../application/commands/create-milestone.handler';
import { UpdateMilestoneCommand } from '../application/commands/update-milestone.handler';
import { DeleteMilestoneCommand } from '../application/commands/delete-milestone.handler';
import { GetBoardQuery, GetProjectQuery, ListProjectsQuery, ListTeamProjectsQuery } from '../application/queries/project.queries';

/** Thin HTTP adapter for the projects context: validate → dispatch → return the contract DTO. */
@Controller()
export class ProjectsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('projects')
  list(@CurrentActor() actor: Actor): Promise<ProjectSummaryDto[]> {
    return this.queries.execute(new ListProjectsQuery(actor));
  }

  @Post('projects')
  @RequirePermission('projects.create')
  async create(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(CreateProjectSchema)) input: CreateProjectInput): Promise<ProjectDetailDto> {
    const { id } = await this.commands.execute<CreateProjectCommand, { id: string }>(new CreateProjectCommand(actor, input));
    return this.queries.execute(new GetProjectQuery(actor, id));
  }

  @Get('projects/:id')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ProjectDetailDto> {
    return this.queries.execute(new GetProjectQuery(actor, id));
  }

  @Patch('projects/:id')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) input: UpdateProjectInput,
  ): Promise<ProjectDetailDto> {
    await this.commands.execute(new UpdateProjectCommand(actor, id, input));
    return this.queries.execute(new GetProjectQuery(actor, id));
  }

  @Post('projects/:id/favorite')
  @HttpCode(200)
  favorite(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<{ isFavorite: boolean }> {
    return this.commands.execute(new SetFavoriteCommand(actor, id, true));
  }

  @Delete('projects/:id/favorite')
  unfavorite(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<{ isFavorite: boolean }> {
    return this.commands.execute(new SetFavoriteCommand(actor, id, false));
  }

  @Get('projects/:id/board')
  board(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<BoardDto> {
    return this.queries.execute(new GetBoardQuery(actor, id));
  }

  @Get('teams/:teamId/projects')
  teamProjects(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<ProjectSummaryDto[]> {
    return this.queries.execute(new ListTeamProjectsQuery(actor, teamId));
  }

  // ── Sections ──
  @Post('projects/:id/sections')
  createSection(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateSectionSchema)) input: CreateSectionInput,
  ): Promise<SectionDto> {
    return this.commands.execute(new CreateSectionCommand(actor, id, input));
  }

  @Patch('sections/:id')
  updateSection(@CurrentActor() actor: Actor, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateSectionSchema)) input: UpdateSectionInput) {
    return this.commands.execute(new UpdateSectionCommand(actor, id, input));
  }

  @Delete('sections/:id')
  @HttpCode(204)
  async deleteSection(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.commands.execute(new DeleteSectionCommand(actor, id));
  }

  // ── Milestones ──
  @Post('projects/:id/milestones')
  createMilestone(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateMilestoneSchema)) input: CreateMilestoneInput,
  ): Promise<MilestoneDto> {
    return this.commands.execute(new CreateMilestoneCommand(actor, id, input));
  }

  @Patch('milestones/:id')
  updateMilestone(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMilestoneSchema)) input: UpdateMilestoneInput,
  ): Promise<MilestoneDto> {
    return this.commands.execute(new UpdateMilestoneCommand(actor, id, input));
  }

  @Delete('milestones/:id')
  @HttpCode(204)
  async deleteMilestone(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.commands.execute(new DeleteMilestoneCommand(actor, id));
  }
}
