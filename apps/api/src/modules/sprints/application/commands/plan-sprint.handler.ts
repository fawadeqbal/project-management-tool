import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import {
  NotFoundError,
  SPRINT_REPOSITORY,
  Sprint,
  parseDateOnly,
  type Clock,
  type SprintRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { toSprintSummary } from '../sprints.ports';
import { PlanSprintCommand } from './plan-sprint.command';
import { defaultSprintDates, newSprintId } from './sprint-ids';

/** Plans the next sprint of a project (Sprint.plan through the repository port). */
@CommandHandler(PlanSprintCommand)
export class PlanSprintHandler implements ICommandHandler<PlanSprintCommand, SprintSummaryDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, projectId, input }: PlanSprintCommand): Promise<SprintSummaryDto> {
    this.access.assert(actor, 'sprints.manage', { projectId });
    const project = await this.prisma.project.count({
      where: { id: projectId, workspaceId: actor.workspaceId },
    });
    if (!project) throw new NotFoundError('Project', projectId);
    const now = this.clock.now();
    const number = await this.sprints.nextNumber(projectId);
    const previous = number > 1 ? await this.latest(actor.workspaceId, projectId) : null;
    const defaults = defaultSprintDates(previous, now);
    const sprint = Sprint.plan(
      {
        id: newSprintId(),
        projectId,
        workspaceId: actor.workspaceId,
        number,
        name: input.name,
        goal: input.goal,
        startDate: input.startDate ? parseDateOnly(input.startDate) : defaults.startDate,
        endDate: input.endDate ? parseDateOnly(input.endDate) : defaults.endDate,
      },
      actor.userId,
      now,
    );
    await this.sprints.save(sprint);
    this.events.publishFrom(sprint);
    return toSprintSummary(sprint, []);
  }

  private async latest(workspaceId: string, projectId: string): Promise<Sprint | null> {
    const row = await this.prisma.sprint.findFirst({
      where: { projectId },
      orderBy: { number: 'desc' },
      select: { id: true },
    });
    return row ? this.sprints.findById(workspaceId, row.id) : null;
  }
}
