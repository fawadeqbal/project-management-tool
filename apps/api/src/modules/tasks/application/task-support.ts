import { createEvent, NotFoundError, type Actor, type DomainEvent, type Task, type TaskRepository } from '@hearth/domain';
import type { TaskDirectory, TaskReferences } from './ports';

/** Loads a task of the actor's workspace or throws a 404 the person can understand. */
export async function loadTask(tasks: TaskRepository, actor: Actor, id: string): Promise<Task> {
  const task = await tasks.findById(actor.workspaceId, id);
  if (!task) throw new NotFoundError('Task', id);
  return task;
}

/** Every id a write points at must exist in the actor's workspace. */
export async function assertReferencesExist(directory: TaskDirectory, actor: Actor, refs: TaskReferences): Promise<void> {
  const missing = await directory.findMissingReference(actor.workspaceId, refs);
  if (missing) throw new NotFoundError(missing.entity === 'Member' ? 'Person' : missing.entity, missing.id);
}

/**
 * `task.updated` for changes that live outside the aggregate's props (tags, epic, ordering,
 * dependencies) so realtime clients, activity and other contexts still hear about them.
 */
export const taskUpdatedEvent = (task: Task, fields: string[], actorId: string, now: Date): DomainEvent =>
  createEvent(
    'task.updated',
    { workspaceId: task.workspaceId, actorId, aggregateId: task.id, occurredAt: now },
    { key: task.key.toString(), fields, projectId: task.projectId },
  );
