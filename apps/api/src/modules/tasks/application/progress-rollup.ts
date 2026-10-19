import type { Actor, Task, TaskRepository, TaskStatus } from '@hearth/domain';
import type { TaskRelations } from './ports';

/** Parent progress = done subtasks / all subtasks × 100 (rounded). No subtasks → null (manual). */
export const rollUpProgress = (statuses: readonly TaskStatus[]): number | null =>
  statuses.length ? Math.round((statuses.filter((s) => s === 'DONE').length / statuses.length) * 100) : null;

/**
 * After a subtask's status changes, recompute and save its parent's progress. Returns the
 * parent when it changed so the caller can publish its events.
 */
export async function updateParentProgress(
  deps: { tasks: TaskRepository; relations: TaskRelations },
  actor: Actor,
  parentId: string | null,
  now: Date,
): Promise<Task | null> {
  if (!parentId) return null;
  const parent = await deps.tasks.findById(actor.workspaceId, parentId);
  if (!parent) return null;
  const progress = rollUpProgress(await deps.relations.subtaskStatuses(parentId));
  if (progress === null || progress === parent.toSnapshot().progress) return null;
  parent.setProgress(progress, actor.userId, now);
  await deps.tasks.save(parent);
  return parent;
}
