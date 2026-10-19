import { z } from 'zod';
import {
  DateOnlySchema,
  IdSchema,
  type PrioritySchema,
  type TaskStatusSchema,
  type UserRefDto,
} from './common';

export type SprintStatusDto = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface SprintSummaryDto {
  id: string;
  projectId: string;
  number: number;
  name: string;
  goal: string | null;
  status: SprintStatusDto;
  startDate: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  /** All points in the sprint now (committed + scope changes). */
  scopePoints: number;
  taskCount: number;
  completedAt: string | null;
}

/** A task as sprint planning shows it: estimates always visible. */
export interface SprintTaskDto {
  id: string;
  key: string;
  title: string;
  status: z.infer<typeof TaskStatusSchema>;
  priority: z.infer<typeof PrioritySchema>;
  points: number | null;
  assignee: UserRefDto | null;
  epic: string | null;
  sprintId: string | null;
  backlogRank: number | null;
}

export interface BurndownDto {
  /** Working days of the sprint, "YYYY-MM-DD" (x axis). */
  days: string[];
  totalDays: number;
  ideal: { date: string; day: number; remaining: number }[];
  actual: { date: string; day: number; remaining: number }[];
  scopeChanges: { date: string; day: number; addedPoints: number; remaining: number }[];
  todayIndex: number | null;
  onPace: boolean;
  /** Actual minus ideal on the latest snapshot (positive = behind). */
  behindBy: number;
  projectedFinishDay: number | null;
  daysLeft: number;
  /** Largest value on the chart (y axis max before rounding). */
  maxPoints: number;
}

export interface VelocityBarDto {
  sprintId: string;
  number: number;
  /** "S21" */
  label: string;
  points: number;
  isPlan: boolean;
}

export interface SprintCapacityDto {
  committed: number;
  velocity: number;
  level: 'ok' | 'near' | 'over';
  ratio: number;
  message: string;
  /** The task worth moving back to the backlog when over velocity. */
  deferTask: { id: string; key: string; title: string; points: number } | null;
}

export interface SprintDetailDto {
  sprint: SprintSummaryDto;
  header: {
    /** "Oct 13 – Oct 26" */
    dateLabel: string;
    daysLeft: number;
    /** "5 working days left" / "Starts Mon" / "Completed Oct 12" */
    statusLabel: string;
    people: UserRefDto[];
  };
  tasks: SprintTaskDto[];
  progress: { donePoints: number; totalPoints: number; donePct: number };
  burndown: BurndownDto;
  velocity: { bars: VelocityBarDto[]; average: number };
  capacity: SprintCapacityDto;
  scopeChanges: { date: string; label: string; addedPoints: number }[];
  /** Other sprints of the project, for the switcher. */
  sprints: SprintSummaryDto[];
}

export interface RetrospectiveDto {
  sprint: SprintSummaryDto;
  completed: SprintTaskDto[];
  /** Pre-sorted: furthest along first, then priority. */
  unfinished: SprintTaskDto[];
  completedPoints: number;
  unfinishedPoints: number;
  completionPct: number;
  movedTo: { kind: 'backlog' | 'next'; sprint: SprintSummaryDto | null };
}

// ── Requests ────────────────────────────────────────────────

export const CreateSprintSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  goal: z.string().trim().max(300).nullish(),
  /** Defaults to the day after the latest sprint ends. */
  startDate: DateOnlySchema.optional(),
  /** Defaults to two weeks after the start. */
  endDate: DateOnlySchema.optional(),
});
export type CreateSprintInput = z.infer<typeof CreateSprintSchema>;

export const UpdateSprintSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the sprint a name.').max(80),
    goal: z.string().trim().max(300).nullable(),
    startDate: DateOnlySchema,
    endDate: DateOnlySchema,
  })
  .partial();
export type UpdateSprintInput = z.infer<typeof UpdateSprintSchema>;

export const CompleteSprintSchema = z.object({
  moveUnfinishedTo: z.enum(['backlog', 'next']).default('backlog'),
});
export type CompleteSprintInput = z.infer<typeof CompleteSprintSchema>;

export const AddSprintTaskSchema = z.object({ taskId: IdSchema });
export type AddSprintTaskInput = z.infer<typeof AddSprintTaskSchema>;

/** Drag-to-rank: `beforeId` is the task that ends up right above, `afterId` right below. */
export const RankBacklogSchema = z.object({
  taskId: IdSchema,
  beforeId: IdSchema.nullish(),
  afterId: IdSchema.nullish(),
});
export type RankBacklogInput = z.infer<typeof RankBacklogSchema>;

export const SPRINT_ROUTES = {
  list: (projectId: string) => `/projects/${projectId}/sprints`,
  backlog: (projectId: string) => `/projects/${projectId}/backlog`,
  rank: (projectId: string) => `/projects/${projectId}/backlog/rank`,
  byId: (id: string) => `/sprints/${id}`,
  start: (id: string) => `/sprints/${id}/start`,
  complete: (id: string) => `/sprints/${id}/complete`,
  tasks: (id: string) => `/sprints/${id}/tasks`,
  task: (id: string, taskId: string) => `/sprints/${id}/tasks/${taskId}`,
} as const;
