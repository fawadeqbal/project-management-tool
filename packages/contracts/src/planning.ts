import { z } from 'zod';
import { DateOnlySchema, IdSchema, type TaskStatusSchema, type UserRefDto } from './common';

// ── Workload ────────────────────────────────────────────────

export const WorkloadUnitSchema = z.enum(['hours', 'tasks', 'points']);
export type WorkloadUnitDto = z.infer<typeof WorkloadUnitSchema>;

export const WorkloadQuerySchema = z.object({
  /** Defaults to Monday of this week. */
  from: DateOnlySchema.optional(),
  /** Defaults to Friday of next week (two working weeks, like the design). */
  to: DateOnlySchema.optional(),
  unit: WorkloadUnitSchema.default('hours'),
  projectId: IdSchema.optional(),
  teamId: IdSchema.optional(),
});
export type WorkloadQuery = z.infer<typeof WorkloadQuerySchema>;

export type LoadStateDto = 'off' | 'free' | 'light' | 'normal' | 'full' | 'over';

export interface WorkloadDayDto {
  date: string;
  /** "Mon 19" */
  label: string;
  isToday: boolean;
  /** First day of a new week after the first column — draw a stronger separator. */
  weekStart: boolean;
}

export interface WorkloadCellDto {
  date: string;
  planned: number;
  capacity: number;
  state: LoadStateDto;
  taskIds: string[];
  /** Each task's share of the day, in the requested unit. */
  items: { taskId: string; amount: number }[];
}

export interface WorkloadPersonDto {
  user: UserRefDto;
  jobTitle: string | null;
  capacityHoursPerDay: number;
  cells: WorkloadCellDto[];
  plannedTotal: number;
  capacityTotal: number;
  loadPct: number;
  overDays: string[];
}

export interface WorkloadTaskDto {
  id: string;
  key: string;
  title: string;
  status: z.infer<typeof TaskStatusSchema>;
  projectId: string | null;
  assigneeId: string | null;
  estimateHours: number | null;
  estimatePoints: number | null;
  startDate: string | null;
  dueDate: string | null;
}

export interface WorkloadSummaryDto {
  capacityUsedPct: number;
  planned: number;
  capacity: number;
  overCapacity: { user: UserRefDto; days: string[]; /** "Wed–Thu" */ label: string }[];
  freeCapacity: number;
  freeBy: { user: UserRefDto; free: number }[];
  timeOff: { user: UserRefDto; days: string[]; /** "Thu 22 – Fri 23" */ label: string }[];
}

/** A rebalance the AI proposes — always a suggestion a person accepts or dismisses. */
export interface RebalanceSuggestionDto {
  id: string;
  task: { id: string; key: string; title: string };
  from: UserRefDto;
  to: UserRefDto;
  days: string[];
  /** "Wed–Thu" */
  dayLabel: string;
  hours: number;
  fromLoadPct: number;
  fromLoadPctAfter: number;
  toLoadPct: number;
  toLoadPctAfter: number;
  reason: string;
  /** Where the suggestion comes from, shown with it. */
  source: string;
}

export interface WorkloadDto {
  range: { from: string; to: string; /** "Oct 19 – Oct 30" */ label: string };
  unit: WorkloadUnitDto;
  days: WorkloadDayDto[];
  people: WorkloadPersonDto[];
  tasks: Record<string, WorkloadTaskDto>;
  summary: WorkloadSummaryDto;
  suggestions: RebalanceSuggestionDto[];
}

// ── Time off & capacity ─────────────────────────────────────

export interface TimeOffDto {
  id: string;
  user: UserRefDto;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export const CreateTimeOffSchema = z
  .object({
    /** Defaults to the signed-in person. Admins and owners can add time off for anyone. */
    userId: IdSchema.optional(),
    startDate: DateOnlySchema,
    endDate: DateOnlySchema,
    reason: z.string().trim().max(200).nullish(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'Time off has to end on or after the day it starts.',
    path: ['endDate'],
  });
export type CreateTimeOffInput = z.infer<typeof CreateTimeOffSchema>;

export const TimeOffQuerySchema = z.object({
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  userId: IdSchema.optional(),
});
export type TimeOffQuery = z.infer<typeof TimeOffQuerySchema>;

export const UpdateCapacitySchema = z.object({
  hoursPerDay: z
    .number()
    .int('Use whole hours, like 6.')
    .min(0)
    .max(24, 'A day has 24 hours — pick 24 or fewer.'),
});
export type UpdateCapacityInput = z.infer<typeof UpdateCapacitySchema>;

export interface CapacityDto {
  userId: string;
  hoursPerDay: number;
}

export const WORKLOAD_SOURCE = 'based on this week’s estimates';

export const WORKLOAD_ROUTES = {
  workload: '/workload',
  timeOff: '/time-off',
  timeOffById: (id: string) => `/time-off/${id}`,
  capacity: (userId: string) => `/members/${userId}/capacity`,
} as const;
