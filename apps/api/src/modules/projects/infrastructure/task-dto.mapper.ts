import type { TaskDto } from '@hearth/contracts';
import type { Prisma } from '@prisma/client';
import { accent, dateOnly, iso, PROJECT_REF_SELECT, toProjectRef, toTaskRef, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';

/**
 * The projects context's own read-side projection of task rows into the shared TaskDto shape
 * (CQRS read side: we query the Task tables directly rather than calling the Tasks context).
 */
export const TASK_CARD_INCLUDE = {
  assignee: { select: USER_REF_SELECT },
  project: { select: PROJECT_REF_SELECT },
  tags: { include: { tag: true } },
  blockedBy: { include: { blocker: { select: { id: true, number: true, title: true, status: true } } } },
  subtasks: { select: { status: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

export type TaskCardRow = Prisma.TaskGetPayload<{ include: typeof TASK_CARD_INCLUDE }>;

export const toTaskDto = (t: TaskCardRow, keyPrefix: string): TaskDto => ({
  id: t.id,
  key: `${keyPrefix}-${t.number}`,
  number: t.number,
  title: t.title,
  status: t.status,
  priority: t.priority,
  assigneeId: t.assigneeId,
  assignee: t.assignee ? toUserRef(t.assignee) : null,
  projectId: t.projectId,
  project: t.project ? toProjectRef(t.project) : null,
  sectionId: t.sectionId,
  parentId: t.parentId,
  sprintId: t.sprintId,
  startDate: dateOnly(t.startDate),
  dueDate: dateOnly(t.dueDate),
  estimatePoints: t.estimatePoints,
  estimateHours: t.estimateHours,
  progress: t.progress,
  epic: t.epic,
  tags: t.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: accent(tag.color) })),
  commentCount: t._count.comments,
  subtaskCount: t.subtasks.length,
  subtaskDoneCount: t.subtasks.filter((s) => s.status === 'DONE').length,
  blockedBy: t.blockedBy.map((d) => toTaskRef(d.blocker, keyPrefix)),
  boardPosition: t.boardPosition,
  listPosition: t.listPosition,
  backlogRank: t.backlogRank,
  completedAt: iso(t.completedAt),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
