import { z } from 'zod';
import { AccentColorSchema, DateOnlySchema, IdSchema, TaskStatusSchema, type UserRefDto } from './common';
import type { TaskDto, TaskStatusDto } from './tasks';

/**
 * Contracts for the projects and timeline bounded contexts: projects, sections, milestones,
 * favorites, board columns with WIP limits, and the Gantt read model + reschedule commands.
 * The calendar has no contract of its own — it reads GET /tasks?from&to (Tasks context).
 */

export const ProjectHealthSchema = z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']);
export type ProjectHealthDto = z.infer<typeof ProjectHealthSchema>;

/** Health is always rendered as icon + label + tone (never color alone). */
export interface HealthMetaDto {
  health: ProjectHealthDto;
  label: string;
  icon: string;
  tone: 'success' | 'warning' | 'danger';
}

export interface ProjectTeamRefDto {
  id: string;
  name: string;
  color: z.infer<typeof AccentColorSchema>;
}

export interface ProjectCountsDto {
  total: number;
  open: number;
  done: number;
  overdue: number;
  blocked: number;
}

/** A row in the projects index, the sidebar favorites and the teams page. */
export interface ProjectSummaryDto {
  id: string;
  name: string;
  color: z.infer<typeof AccentColorSchema>;
  icon: string;
  owner: UserRefDto;
  team: ProjectTeamRefDto | null;
  health: HealthMetaDto;
  /** 0–100, done / total top-level tasks. */
  progress: number;
  counts: ProjectCountsDto;
  startDate: string | null;
  dueDate: string | null;
  isFavorite: boolean;
}

export interface SectionDto {
  id: string;
  name: string;
  position: number;
  taskCount: number;
}

export interface MilestoneDto {
  id: string;
  name: string;
  date: string;
  done: boolean;
  /** Tasks that must finish before the milestone (finish-to-milestone links). */
  dependsOnTaskIds: string[];
}

/** WIP limits per board column (status). Absent = no limit. */
export type WipLimitsDto = Partial<Record<TaskStatusDto, number>>;

export interface ProjectMemberDto extends UserRefDto {
  /** Open tasks assigned to them in this project. */
  openTasks: number;
  isOwner: boolean;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  description: string | null;
  sections: SectionDto[];
  milestones: MilestoneDto[];
  members: ProjectMemberDto[];
  wipLimits: WipLimitsDto;
  /** What the schedule suggests (evaluateHealth); `health` is the owner's call. */
  suggestedHealth: HealthMetaDto & { reason: string };
  budgetUsedPct: number | null;
  /** Largest start slip against the baseline, for "At risk · HRT-188 slipped 2 days". */
  slip: { taskId: string; key: string; title: string; days: number } | null;
}

export type WipLevelDto = 'ok' | 'near' | 'over';

export interface BoardColumnDto {
  status: TaskStatusDto;
  label: string;
  count: number;
  wipLimit: number | null;
  wipLevel: WipLevelDto;
  tasks: TaskDto[];
}

export interface BoardDto {
  projectId: string;
  columns: BoardColumnDto[];
}

// ── Requests ────────────────────────────────────────────────

const WipLimitsSchema = z
  .record(TaskStatusSchema, z.number().int().min(1, 'Use a limit of at least 1.').max(99, 'Keep WIP limits under 100.').nullable())
  .refine((v) => !('DONE' in v) || v.DONE == null, { message: 'The Done column can’t have a WIP limit.' });

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name your project — it can’t be empty.').max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(5000).nullish(),
  color: AccentColorSchema.default('blue'),
  icon: z.string().trim().min(1).max(32).optional(),
  teamId: IdSchema.nullish(),
  startDate: DateOnlySchema.nullish(),
  dueDate: DateOnlySchema.nullish(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Name your project — it can’t be empty.').max(80),
    description: z.string().trim().max(5000).nullable(),
    color: AccentColorSchema,
    icon: z.string().trim().min(1).max(32),
    health: ProjectHealthSchema,
    teamId: IdSchema.nullable(),
    startDate: DateOnlySchema.nullable(),
    dueDate: DateOnlySchema.nullable(),
    wipLimits: WipLimitsSchema,
  })
  .partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreateSectionSchema = z.object({
  name: z.string().trim().min(1, 'Name the section first.').max(60),
  /** Insert before this section; appended when omitted. */
  beforeId: IdSchema.nullish(),
});
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;

export const UpdateSectionSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the section first.').max(60),
    /** Move to this index (0-based) among the project's sections. */
    position: z.number().int().min(0).max(500),
  })
  .partial();
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;

export const CreateMilestoneSchema = z.object({
  name: z.string().trim().min(1, 'Name the milestone first.').max(80),
  date: DateOnlySchema,
  dependsOnTaskIds: z.array(IdSchema).max(50).optional(),
});
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

export const UpdateMilestoneSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the milestone first.').max(80),
    date: DateOnlySchema,
    done: z.boolean(),
    dependsOnTaskIds: z.array(IdSchema).max(50),
  })
  .partial();
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

export const PROJECT_ROUTES = {
  list: '/projects',
  byId: (id: string) => `/projects/${id}`,
  favorite: (id: string) => `/projects/${id}/favorite`,
  board: (id: string) => `/projects/${id}/board`,
  sections: (id: string) => `/projects/${id}/sections`,
  section: (id: string) => `/sections/${id}`,
  milestones: (id: string) => `/projects/${id}/milestones`,
  milestone: (id: string) => `/milestones/${id}`,
  teamProjects: (teamId: string) => `/teams/${teamId}/projects`,
} as const;

// ── Timeline (Gantt) ────────────────────────────────────────

export interface TimelineSectionRowDto {
  kind: 'section';
  id: string;
  name: string;
}

export interface TimelineTaskRowDto {
  kind: 'task';
  id: string;
  key: string;
  title: string;
  status: TaskStatusDto;
  sectionId: string | null;
  startDate: string;
  dueDate: string;
  baselineStart: string | null;
  baselineDue: string | null;
  progress: number;
  assignee: UserRefDto | null;
  critical: boolean;
}

export interface TimelineMilestoneRowDto {
  kind: 'milestone';
  id: string;
  name: string;
  date: string;
  done: boolean;
  critical: boolean;
}

export type TimelineRowDto = TimelineSectionRowDto | TimelineTaskRowDto | TimelineMilestoneRowDto;

/** blocker → blocked (task→task, or task→milestone from MilestoneDependency). */
export interface TimelineLinkDto {
  fromId: string;
  toId: string;
  critical: boolean;
}

export interface TimelineConflictDto {
  taskId: string;
  blockerId: string;
  blockerKey: string | null;
  overlapDays: number;
}

export interface TimelineDto {
  projectId: string;
  from: string;
  to: string;
  today: string;
  rows: TimelineRowDto[];
  links: TimelineLinkDto[];
  criticalIds: string[];
  conflicts: TimelineConflictDto[];
}

export const TimelineQuerySchema = z.object({
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
});
export type TimelineQuery = z.infer<typeof TimelineQuerySchema>;

const scheduleDates = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).refine((v: { startDate?: string | null; dueDate?: string | null }) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: 'The due date has to be on or after the start date.',
    path: ['dueDate'],
  });

export const RescheduleTaskSchema = scheduleDates({
  startDate: DateOnlySchema,
  dueDate: DateOnlySchema,
  /** Push dependents (and gated milestones) that would now start too early. */
  shiftDependents: z.boolean().default(true),
});
export type RescheduleTaskInput = z.infer<typeof RescheduleTaskSchema>;

export const ScheduleItemSchema = z.object({
  kind: z.enum(['task', 'milestone']),
  id: IdSchema,
  startDate: DateOnlySchema.nullable(),
  dueDate: DateOnlySchema.nullable(),
});
export type ScheduleItemInput = z.infer<typeof ScheduleItemSchema>;

/** Sets explicit dates for several items at once — used by Undo after a reschedule. */
export const ApplyScheduleSchema = z.object({ items: z.array(ScheduleItemSchema).min(1).max(200) });
export type ApplyScheduleInput = z.infer<typeof ApplyScheduleSchema>;

export interface ScheduleChangeDto {
  kind: 'task' | 'milestone';
  id: string;
  /** Task key, or the milestone name. */
  label: string;
  days: number;
  startDate: string | null;
  dueDate: string | null;
}

export interface RescheduleResultDto {
  /** The moved task's new dates. */
  task: ScheduleChangeDto;
  /** Dependents pushed forward ("3 dependents shifted"). */
  shifted: { taskId: string; key: string; days: number; kind: 'task' | 'milestone' }[];
  /** Every changed item's dates before the change — post these to /timeline/schedule to undo. */
  previous: ScheduleItemInput[];
}

export const TIMELINE_ROUTES = {
  byProject: (projectId: string) => `/projects/${projectId}/timeline`,
  reschedule: (taskId: string) => `/timeline/tasks/${taskId}/reschedule`,
  schedule: '/timeline/schedule',
} as const;
