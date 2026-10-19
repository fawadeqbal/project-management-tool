import {
  assertCanBeAssigned,
  canViewProject,
  createEvent,
  NotFoundError,
  ValidationError,
  type Actor,
  type DomainEvent,
  type Task,
  type TaskRepository,
} from '@hearth/domain';
import type { TaskDirectory, TaskReferences } from './ports';

/**
 * Loads a task the actor can see, or throws a 404 the person can understand. Tasks in projects
 * hidden from a guest are reported exactly like tasks that don't exist.
 */
export async function loadTask(tasks: TaskRepository, actor: Actor, id: string): Promise<Task> {
  const task = await tasks.findById(actor.workspaceId, id);
  if (!task || !canViewProject(actor, task.projectId)) throw new NotFoundError('Task', id);
  return task;
}

const OTHER_PROJECT: Record<'Section' | 'Sprint' | 'Task', { code: string; message: string; field: string }> = {
  Section: {
    code: 'task.section_project',
    message: 'That section belongs to another project. Pick a section from this task’s project.',
    field: 'sectionId',
  },
  Sprint: {
    code: 'task.sprint_project',
    message:
      'That sprint belongs to another project. Pick one of this project’s sprints, or move the task first.',
    field: 'sprintId',
  },
  Task: {
    code: 'task.parent_project',
    message: 'A subtask lives in its parent’s project. Pick a parent task from the same project.',
    field: 'parentId',
  },
};

/**
 * Every id a write points at must exist in the actor's workspace and be visible to them; sections,
 * sprints and parents must also belong to the task's (target) project. Something the actor can't
 * see is reported as missing (404) so hidden ids can't be confirmed.
 */
export async function assertReferencesExist(
  directory: TaskDirectory,
  actor: Actor,
  refs: TaskReferences,
): Promise<void> {
  const problem = await directory.checkReferences(actor.workspaceId, refs);
  if (!problem) return;
  if (problem.kind === 'missing')
    throw new NotFoundError(problem.entity === 'Member' ? 'Person' : problem.entity, problem.id);
  if (!canViewProject(actor, problem.projectId)) throw new NotFoundError(problem.entity, problem.id);
  const { code, message, field } = OTHER_PROJECT[problem.entity];
  throw new ValidationError(code, message, { field });
}

/** A person can only be assigned work in a project they can see (guests: their projects). */
export async function assertAssignable(
  directory: TaskDirectory,
  workspaceId: string,
  assigneeId: string,
  projectId: string | null,
): Promise<void> {
  const facts = await directory.assigneeFacts(workspaceId, assigneeId);
  if (!facts) throw new NotFoundError('Person', assigneeId);
  assertCanBeAssigned(facts, projectId);
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
