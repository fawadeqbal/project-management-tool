import { Injectable } from '@nestjs/common';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

const STEP_IDS = new Set<string>(ONBOARDING_STEPS.map((s) => s.id));

/** Stored checklist state per person and workspace (OnboardingProgress row). */
@Injectable()
export class OnboardingProgressStore {
  constructor(private readonly prisma: PrismaService) {}

  async get(workspaceId: string, userId: string): Promise<{ completedSteps: OnboardingStepId[]; dismissedAt: Date | null }> {
    const row = await this.prisma.onboardingProgress.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    return {
      completedSteps: (row?.completedSteps ?? ['create-workspace']).filter((s): s is OnboardingStepId => STEP_IDS.has(s)),
      dismissedAt: row?.dismissedAt ?? null,
    };
  }

  /** Idempotent: returns true when the step was newly completed. */
  async complete(workspaceId: string, userId: string, step: OnboardingStepId): Promise<boolean> {
    const current = await this.get(workspaceId, userId);
    if (current.completedSteps.includes(step)) return false;
    const completedSteps = [...new Set<string>(['create-workspace', ...current.completedSteps, step])];
    await this.prisma.onboardingProgress.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, completedSteps },
      update: { completedSteps },
    });
    return true;
  }

  async dismiss(workspaceId: string, userId: string, at: Date): Promise<void> {
    await this.prisma.onboardingProgress.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, completedSteps: ['create-workspace'], dismissedAt: at },
      update: { dismissedAt: at },
    });
  }
}
