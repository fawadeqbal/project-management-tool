import { z } from 'zod';
import type { AccentColorSchema, ProjectRefDto } from './common';

// Contracts for the onboarding bounded context (first-run Home: checklist and templates).

export const ONBOARDING_STEP_IDS = ['create-workspace', 'start-from-template', 'create-first-task', 'invite-teammates', 'connect-slack'] as const;
export const OnboardingStepIdSchema = z.enum(ONBOARDING_STEP_IDS);
export type OnboardingStepIdDto = z.infer<typeof OnboardingStepIdSchema>;

export interface OnboardingStepDto {
  id: OnboardingStepIdDto;
  title: string;
  /** Why it matters, or what was done ("HRT-1 · Kickoff meeting"). */
  hint: string;
  done: boolean;
  isNext: boolean;
}

export interface OnboardingDto {
  steps: OnboardingStepDto[];
  completed: number;
  total: number;
  nextStep: string | null;
  isComplete: boolean;
  dismissed: boolean;
}

export interface ProjectTemplateDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: z.infer<typeof AccentColorSchema>;
  sections: string[];
  taskCount: number;
  featured: boolean;
}

export const ApplyTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Give the project a name.').max(80).optional(),
});
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateSchema>;

export interface ApplyTemplateResultDto {
  project: ProjectRefDto;
  taskCount: number;
  firstTaskKey: string | null;
}

export const ONBOARDING_ROUTES = {
  onboarding: '/onboarding',
  completeStep: (id: string) => `/onboarding/steps/${id}/complete`,
  dismiss: '/onboarding/dismiss',
  templates: '/templates',
  applyTemplate: (id: string) => `/templates/${id}/apply`,
} as const;
