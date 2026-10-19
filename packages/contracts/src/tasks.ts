import { z } from 'zod';
import {
  DateOnlySchema,
  IdSchema,
  PrioritySchema,
  TaskStatusSchema,
  type ProjectRefDto,
  type TaskRefDto,
  type UserRefDto,
} from './common';
import type { TagDto } from './workspace';

export type TaskStatusDto = z.infer<typeof TaskStatusSchema>;
export type PriorityDto = z.infer<typeof PrioritySchema>;

/** A task as it appears in lists, boards, calendars and timelines. Satisfies FilterableTask. */
export interface TaskDto {
  id: string;
  key: string;
  number: number;
  title: string;
  status: TaskStatusDto;
  priority: PriorityDto;
  assigneeId: string | null;
  assignee: UserRefDto | null;
  projectId: string | null;
  project: ProjectRefDto | null;
  sectionId: string | null;
  parentId: string | null;
  sprintId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatePoints: number | null;
  estimateHours: number | null;
  progress: number;
  epic: string | null;
  tags: TagDto[];
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  blockedBy: TaskRefDto[];
  boardPosition: number;
  listPosition: number;
  backlogRank: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  taskId: string;
  author: UserRefDto;
  body: string;
  parentId: string | null;
  mentions: UserRefDto[];
  createdAt: string;
  editedAt: string | null;
}

export interface ActivityDto {
  id: string;
  type: string;
  actor: UserRefDto;
  /** Pre-rendered sentence in the Hearth voice: "changed status to In review". */
  summary: string;
  createdAt: string;
}

/** Full task for the side panel and the full-page view. */
export interface TaskDetailDto extends TaskDto {
  description: string | null;
  creator: UserRefDto;
  subtasks: TaskDto[];
  comments: CommentDto[];
  activity: ActivityDto[];
  blocking: TaskRefDto[];
  followerIds: string[];
  sprint: { id: string; name: string } | null;
}

// ── Requests ────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Add a title — it can’t be empty.').max(500),
  description: z.string().max(20_000).nullish(),
  projectId: IdSchema.nullish(),
  sectionId: IdSchema.nullish(),
  parentId: IdSchema.nullish(),
  sprintId: IdSchema.nullish(),
  assigneeId: IdSchema.nullish(),
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  startDate: DateOnlySchema.nullish(),
  dueDate: DateOnlySchema.nullish(),
  estimatePoints: z.number().int().min(0).max(100).nullish(),
  estimateHours: z.number().min(0).max(1000).nullish(),
  tagIds: z.array(IdSchema).max(20).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

/** "Draft retro agenda @sara #website !high tomorrow" — parsed server-side with the domain parser. */
export const QuickAddTaskSchema = z.object({
  text: z.string().trim().min(1, 'Type a task first.').max(600),
  projectId: IdSchema.nullish(),
  /** Defaults to the current user when nothing is @mentioned (My tasks quick add). */
  assignToMe: z.boolean().default(true),
});
export type QuickAddTaskInput = z.infer<typeof QuickAddTaskSchema>;

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20_000).nullable(),
    status: TaskStatusSchema,
    priority: PrioritySchema,
    assigneeId: IdSchema.nullable(),
    startDate: DateOnlySchema.nullable(),
    dueDate: DateOnlySchema.nullable(),
    estimatePoints: z.number().int().min(0).max(100).nullable(),
    estimateHours: z.number().min(0).max(1000).nullable(),
    progress: z.number().int().min(0).max(100),
    projectId: IdSchema.nullable(),
    sectionId: IdSchema.nullable(),
    sprintId: IdSchema.nullable(),
    epic: z.string().trim().max(60).nullable(),
    tagIds: z.array(IdSchema).max(20),
  })
  .partial();
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/** Board drag-and-drop and list reordering: new column (status) and neighbours. */
export const MoveTaskSchema = z.object({
  status: TaskStatusSchema.optional(),
  beforeId: IdSchema.nullish(),
  afterId: IdSchema.nullish(),
  /** Which ordering to update. */
  ordering: z.enum(['board', 'list']).default('board'),
});
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item));

/** Query-string boolean: "true"/"1" → true, "false"/"0"/"" → false (z.coerce.boolean treats "false" as true). */
export const QueryBoolean = z.preprocess(
  (v) => (typeof v === 'string' ? ['true', '1', 'yes'].includes(v.toLowerCase()) : v),
  z.boolean(),
);

export const ListTasksQuerySchema = z.object({
  scope: z.enum(['mine', 'project', 'workspace']).default('mine'),
  projectId: IdSchema.optional(),
  sprintId: IdSchema.optional(),
  parentId: IdSchema.optional(),
  statuses: csv(TaskStatusSchema).optional(),
  priorities: csv(PrioritySchema).optional(),
  assigneeIds: csv(IdSchema).optional(),
  tags: csv(z.string()).optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  overdue: QueryBoolean.optional(),
  includeDone: QueryBoolean.optional(),
  includeSubtasks: QueryBoolean.optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;

export const CreateCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(10_000),
  parentId: IdSchema.nullish(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const AddDependencySchema = z.object({ blockerId: IdSchema });
export type AddDependencyInput = z.infer<typeof AddDependencySchema>;

export const TASK_ROUTES = {
  list: '/tasks',
  quickAdd: '/tasks/quick-add',
  byId: (id: string) => `/tasks/${id}`,
  byKey: (key: string) => `/tasks/key/${key}`,
  move: (id: string) => `/tasks/${id}/move`,
  comments: (id: string) => `/tasks/${id}/comments`,
  dependencies: (id: string) => `/tasks/${id}/dependencies`,
  dependency: (id: string, blockerId: string) => `/tasks/${id}/dependencies/${blockerId}`,
  follow: (id: string) => `/tasks/${id}/follow`,
} as const;
