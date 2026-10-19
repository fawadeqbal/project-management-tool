import type { MilestoneDto } from '@hearth/contracts';
import { toDateOnly, ValidationError } from '@hearth/domain';
import type { MilestoneRecord, MilestoneStore } from '../projects.ports';

export const toMilestoneDto = (m: MilestoneRecord): MilestoneDto => ({
  id: m.id,
  name: m.name,
  date: toDateOnly(m.date),
  done: !!m.doneAt,
  dependsOnTaskIds: [...m.dependsOnTaskIds],
});

/** A milestone may only wait on tasks from its own project. */
export async function assertTasksInProject(store: MilestoneStore, projectId: string, taskIds: string[]): Promise<string[]> {
  const unique = [...new Set(taskIds)];
  const found = await store.tasksInProject(projectId, unique);
  if (found.length !== unique.length)
    throw new ValidationError('milestone.foreign_task', 'A milestone can only depend on tasks in the same project. Remove the others and try again.', {
      field: 'dependsOnTaskIds',
    });
  return unique;
}
