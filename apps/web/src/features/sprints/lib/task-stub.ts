import type { TaskDto, UserRefDto } from '@hearth/contracts';

/**
 * The shared task mutations (useTaskMutations) speak TaskDto. Planning screens hold slimmer read
 * models; this fills the rest with neutral defaults so `toggleDone`/`update` can compute Undo
 * from the fields they touch (status, assigneeId).
 */
export const taskStub = (t: {
  id: string;
  key: string;
  title: string;
  status?: TaskDto['status'];
  priority?: TaskDto['priority'];
  assignee?: UserRefDto | null;
  assigneeId?: string | null;
  points?: number | null;
  projectId?: string | null;
  sprintId?: string | null;
}): TaskDto => ({
  id: t.id,
  key: t.key,
  number: Number(t.key.split('-')[1] ?? 0),
  title: t.title,
  status: t.status ?? 'TODO',
  priority: t.priority ?? 'NONE',
  assigneeId: t.assigneeId !== undefined ? t.assigneeId : (t.assignee?.id ?? null),
  assignee: t.assignee ?? null,
  projectId: t.projectId ?? null,
  project: null,
  sectionId: null,
  parentId: null,
  sprintId: t.sprintId ?? null,
  startDate: null,
  dueDate: null,
  estimatePoints: t.points ?? null,
  estimateHours: null,
  progress: 0,
  epic: null,
  tags: [],
  commentCount: 0,
  subtaskCount: 0,
  subtaskDoneCount: 0,
  blockedBy: [],
  boardPosition: 0,
  listPosition: 0,
  backlogRank: null,
  completedAt: null,
  createdAt: '',
  updatedAt: '',
});
