import { z } from 'zod';
import { IdSchema, type ProjectRefDto, type TaskStatusSchema, type UserRefDto } from './common';

// Contracts for the reporting bounded context (Dashboard screen).

export const ReportRangeSchema = z.enum(['2w', '6w', 'q']);
export type ReportRangeDto = z.infer<typeof ReportRangeSchema>;

export const DashboardQuerySchema = z.object({
  range: ReportRangeSchema.default('6w'),
  projectId: IdSchema.optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export interface KpiDto {
  label: string;
  value: string;
  delta: string;
  deltaTone: 'good' | 'bad' | 'neutral';
  /** What "good" means: "vs. previous 6 weeks", "target 85%", "lower is better". */
  sub: string;
}

export interface ThroughputWeekDto {
  label: string;
  weekStart: string;
  created: number;
  completed: number;
}

export interface StatusMixDto {
  status: z.infer<typeof TaskStatusSchema>;
  label: string;
  count: number;
  pct: number;
}

export type DashboardHealthDto = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

export interface ProjectHealthRowDto {
  project: ProjectRefDto;
  health: DashboardHealthDto;
  healthMeta: { label: string; icon: string; tone: 'success' | 'warning' | 'danger' };
  suggestedHealth: DashboardHealthDto;
  suggestedReason: string;
  owner: UserRefDto;
  progress: number;
  totalTasks: number;
  doneTasks: number;
  due: string | null;
  budgetUsedPct: number | null;
  budgetTone: 'normal' | 'danger';
}

export const DASHBOARD_WIDGETS = ['kpis', 'throughput', 'status-mix', 'project-health'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];

export interface DashboardDto {
  title: string;
  range: ReportRangeDto;
  rangeLabel: string;
  projectCount: number;
  kpis: KpiDto[];
  throughput: ThroughputWeekDto[];
  throughputVerdict: { text: string; tone: 'good' | 'bad'; keptUp: number; weeks: number };
  statusMix: StatusMixDto[];
  /** "6 tasks blocked for more than 3 days — 4 of them in Mobile app v2." (null when none). */
  blockedNote: string | null;
  projects: ProjectHealthRowDto[];
  layout: DashboardWidgetId[];
  schedule: { cadence: 'weekly'; recipients: string[] } | null;
  generatedAt: string;
}

export const ScheduleDashboardSchema = z.object({
  cadence: z.literal('weekly').default('weekly'),
  recipients: z
    .array(z.string().trim().toLowerCase().email('Use an email like sara@acme.com.'))
    .min(1, 'Add at least one recipient.')
    .max(20),
});
export type ScheduleDashboardInput = z.infer<typeof ScheduleDashboardSchema>;

export const UpdateDashboardLayoutSchema = z.object({
  widgets: z
    .array(z.enum(DASHBOARD_WIDGETS))
    .min(1)
    .max(DASHBOARD_WIDGETS.length)
    .refine((w) => new Set(w).size === w.length, 'Each widget can appear once.'),
});
export type UpdateDashboardLayoutInput = z.infer<typeof UpdateDashboardLayoutSchema>;

export const REPORTING_ROUTES = {
  dashboard: '/dashboard',
  schedule: '/dashboard/schedule',
  layout: '/dashboard/layout',
} as const;
