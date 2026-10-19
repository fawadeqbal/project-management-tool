import { z } from 'zod';

// Contracts for the billing bounded context (Billing & plan screen, contextual upgrade prompt).

export const PlanIdSchema = z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);
export type PlanIdDto = z.infer<typeof PlanIdSchema>;
export const BillingIntervalSchema = z.enum(['MONTHLY', 'ANNUAL']);
export type BillingIntervalDto = z.infer<typeof BillingIntervalSchema>;

export interface UsageMeterDto {
  meter: 'seats' | 'storage_bytes' | 'automation_runs' | 'ai_credits';
  label: string;
  icon: string;
  used: number;
  limit: number | null;
  /** Formatted: "18 GB", "940". */
  usedLabel: string;
  limitLabel: string;
  pct: number;
  note: string;
  warning: boolean;
}

export interface PlanCardDto {
  id: PlanIdDto;
  name: string;
  tagline: string;
  /** Per seat per month in cents for each interval; null = custom pricing. */
  monthlyPerSeatCents: number | null;
  annualPerSeatCents: number | null;
  /** "$10", "$8", "$0" or "Custom". */
  priceLabel: { MONTHLY: string; ANNUAL: string };
  priceNote: string;
  highlights: string[];
  /** For the current seat count; null when there is nothing to save. */
  annualSavings: { perYearCents: number; label: string; pct: number } | null;
  isCurrent: boolean;
  isRecommended: boolean;
  /** What the button does from the current plan. */
  action: 'current' | 'upgrade' | 'downgrade' | 'contact';
  /** Features turned off by moving here (downgrades). */
  lostFeatures: { id: string; name: string }[];
}

export interface BillingDto {
  current: {
    plan: PlanIdDto;
    planName: string;
    interval: BillingIntervalDto;
    status: 'ACTIVE' | 'PAUSED' | 'CANCELED';
    seats: number;
    renewsAt: string;
    /** "Nov 1". */
    renewsLabel: string;
    pausedUntil: string | null;
  };
  usage: UsageMeterDto[];
  /** The most urgent meter warning, for the banner (null when nothing is close to a limit). */
  alert: { meter: string; title: string; body: string } | null;
  plans: PlanCardDto[];
  recommendedPlan: PlanIdDto;
  canManage: boolean;
}

export const ChangePlanSchema = z.object({
  plan: PlanIdSchema,
  interval: BillingIntervalSchema.default('MONTHLY'),
  confirm: z.boolean().optional().default(false),
});
export type ChangePlanInput = z.infer<typeof ChangePlanSchema>;

export interface ChangePlanResultDto {
  billing: BillingDto;
  lostFeatures: string[];
}

export const PauseBillingSchema = z.object({
  months: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    errorMap: () => ({ message: 'You can pause for 1, 2 or 3 months.' }),
  }),
});
export type PauseBillingInput = z.infer<typeof PauseBillingSchema>;

export const CancelPlanSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: 'Confirm to cancel your plan.' }) }),
});
export type CancelPlanInput = z.infer<typeof CancelPlanSchema>;

export interface FeatureLimitDto {
  feature: string;
  allowed: boolean;
  featureName: string;
  pitch: string;
  requiredPlan: PlanIdDto;
  requiredPlanName: string;
  currentPlan: PlanIdDto;
}

export interface WorkspaceExportDto {
  exportedAt: string;
  workspace: { id: string; name: string };
  projects: {
    id: string;
    name: string;
    description: string | null;
    sections: string[];
    startDate: string | null;
    dueDate: string | null;
  }[];
  tasks: {
    key: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    project: string | null;
    section: string | null;
    assignee: string | null;
    startDate: string | null;
    dueDate: string | null;
    completedAt: string | null;
    createdAt: string;
  }[];
}

export const BILLING_ROUTES = {
  billing: '/billing',
  plan: '/billing/plan',
  pause: '/billing/pause',
  resume: '/billing/resume',
  cancel: '/billing/cancel',
  export: '/billing/export',
  limit: (feature: string) => `/billing/limits/${feature}`,
} as const;
