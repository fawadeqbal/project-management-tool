import { Inject } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import { sprintSnapshotOf, type Clock, type DomainEvent } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import { DomainEventSubscriber } from '../../../../shared/events/domain-event.subscriber';
import {
  SPRINT_SNAPSHOT_STORE,
  SPRINT_TASK_STORE,
  type SprintSnapshotStore,
  type SprintTaskStore,
} from '../sprints.ports';

/**
 * Keeps today's burndown snapshot current: whenever a task's status or estimate changes, or work
 * is added to / removed from a sprint, recompute remaining (open points) and scope (all points)
 * for the affected active sprint and upsert today's row.
 */
@EventsHandler(DomainEventEnvelope)
export class BurndownSnapshotHandler extends DomainEventSubscriber {
  protected readonly types = [
    'task.status_changed',
    'task.updated',
    'task.deleted',
    'task.moved',
    'sprint.task_added',
    'sprint.task_removed',
  ];

  constructor(
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    @Inject(SPRINT_SNAPSHOT_STORE) private readonly snapshots: SprintSnapshotStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super();
  }

  protected async on(event: DomainEvent): Promise<void> {
    for (const sprintId of await this.affectedSprints(event)) {
      if ((await this.snapshots.statusOf(sprintId)) !== 'ACTIVE') continue;
      const items = await this.tasks.itemsInSprint(sprintId);
      const { remainingPoints, scopePoints } = sprintSnapshotOf(items);
      await this.snapshots.upsert(sprintId, this.clock.now(), remainingPoints, scopePoints);
    }
  }

  private async affectedSprints(event: DomainEvent): Promise<string[]> {
    if (event.type.startsWith('sprint.')) return [event.aggregateId];
    const payload = event.payload as {
      projectId?: string | null;
      fromProjectId?: string | null;
      toProjectId?: string | null;
    };
    const task =
      event.type === 'task.deleted' ? null : await this.tasks.findTask(event.workspaceId, event.aggregateId);
    if (task?.sprintId) return [task.sprintId];
    // The task left its sprint (or was deleted): refresh the project's active sprint(s).
    const projects = [payload.projectId, payload.fromProjectId, payload.toProjectId].filter(
      (p): p is string => !!p,
    );
    const ids = await Promise.all([...new Set(projects)].map((p) => this.snapshots.activeSprintIds(p)));
    return [...new Set(ids.flat())];
  }
}
