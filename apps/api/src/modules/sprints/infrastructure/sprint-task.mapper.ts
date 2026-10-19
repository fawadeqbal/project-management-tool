import { Prisma } from '@prisma/client';
import type { SprintTaskDto } from '@hearth/contracts';
import { toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';

export const SPRINT_TASK_SELECT = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  estimatePoints: true,
  epic: true,
  sprintId: true,
  backlogRank: true,
  assignee: { select: USER_REF_SELECT },
  workspace: { select: { keyPrefix: true } },
} satisfies Prisma.TaskSelect;

export type SprintTaskRow = Prisma.TaskGetPayload<{ select: typeof SPRINT_TASK_SELECT }>;

export const toSprintTaskDto = (t: SprintTaskRow): SprintTaskDto => ({
  id: t.id,
  key: `${t.workspace.keyPrefix}-${t.number}`,
  title: t.title,
  status: t.status,
  priority: t.priority,
  points: t.estimatePoints,
  assignee: t.assignee ? toUserRef(t.assignee) : null,
  epic: t.epic,
  sprintId: t.sprintId,
  backlogRank: t.backlogRank,
});
