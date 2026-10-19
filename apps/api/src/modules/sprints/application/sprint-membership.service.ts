import { Inject, Injectable } from '@nestjs/common';
import {
  canViewProject,
  NotFoundError,
  ranksAtTop,
  SPRINT_REPOSITORY,
  ValidationError,
  type Actor,
  type Clock,
  type Sprint,
  type SprintRepository,
} from '@hearth/domain';
import { AccessService } from '../../../shared/access/access.service';
import { CLOCK } from '../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../shared/events/domain-event.publisher';
import { PlanService } from '../../../shared/billing/require-feature';
import { SPRINT_TASK_STORE, type SprintTaskStore } from './sprints.ports';
import type { SprintChange, SprintMembership } from './sprint-membership.port';

/** The sprint-side rules for a task changing sprint (see SprintMembership). */
@Injectable()
export class SprintMembershipService implements SprintMembership {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    private readonly access: AccessService,
    private readonly plans: PlanService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async changeSprint(actor: Actor, change: SprintChange): Promise<void> {
    if (change.from === change.to) return;
    const now = this.clock.now();
    const task = { id: change.taskId, points: change.points };
    const from = change.from ? await this.sprints.findById(actor.workspaceId, change.from) : null;
    const to = change.to ? await this.load(actor, change.to) : null;

    if (!change.implicit) {
      for (const s of [from, to]) if (s) this.access.assert(actor, 'sprints.manage', { projectId: s.projectId });
      (await this.plans.policyFor(actor.workspaceId)).assertFeature('sprints');
    }
    if (to && to.projectId !== change.projectId)
      throw new ValidationError(
        'sprint.task_project',
        'That sprint belongs to another project. Move the task to that project first.',
        { field: 'sprintId' },
      );

    const touched: Sprint[] = [];
    if (from && !(change.implicit && from.status === 'COMPLETED')) {
      from.removeTask(task, actor.userId, now);
      touched.push(from);
    }
    if (to) {
      to.addTask(task, actor.userId, now);
      touched.push(to);
    }
    // Leaving a sprint for the backlog puts the task on top of it, like "Move to backlog".
    if (!to && from && !change.implicit && change.projectId) {
      const [rank] = ranksAtTop(await this.tasks.topBacklogRank(change.projectId), 1);
      await this.tasks.moveToBacklog([{ taskId: change.taskId, rank: rank! }]);
    }
    this.events.publishFrom(...touched);
  }

  /** A sprint the actor can see, or a 404 (hidden sprints look exactly like missing ones). */
  private async load(actor: Actor, sprintId: string): Promise<Sprint> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint || !canViewProject(actor, sprint.projectId)) throw new NotFoundError('Sprint', sprintId);
    return sprint;
  }
}
