import { Injectable } from '@nestjs/common';
import type { OnboardingDto, ProjectTemplateDto } from '@hearth/contracts';
import {
  inferOnboardingSteps,
  onboardingProgress,
  PROJECT_TEMPLATES,
  type Actor,
  type OnboardingStepId,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { OnboardingProgressStore } from './onboarding-progress.store';

/**
 * Getting-started checklist: stored steps merged with steps inferred from facts, so the list
 * never asks for something already done. "Invite 2 teammates" counts people this person brought
 * in (accepted invites) plus themselves; Slack is never connected in this build.
 */
@Injectable()
export class OnboardingReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: OnboardingProgressStore,
  ) {}

  async get(actor: Actor): Promise<OnboardingDto> {
    const { workspaceId, userId } = actor;
    const [stored, tasksCreatedByUser, acceptedInvites, firstTask, workspace] = await Promise.all([
      this.store.get(workspaceId, userId),
      this.prisma.task.count({ where: { workspaceId, creatorId: userId } }),
      this.prisma.invite.count({ where: { workspaceId, invitedById: userId, status: 'ACCEPTED' } }),
      this.prisma.task.findFirst({
        where: { workspaceId, creatorId: userId },
        orderBy: { createdAt: 'asc' },
        select: { number: true, title: true },
      }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { keyPrefix: true } }),
    ]);
    const inferred = inferOnboardingSteps({
      tasksCreatedByUser,
      activeMembers: 1 + acceptedInvites,
      projectsFromTemplate: stored.completedSteps.includes('start-from-template') ? 1 : 0,
      slackConnected: false,
    });
    const done = [...new Set<OnboardingStepId>([...stored.completedSteps, ...inferred])];
    const progress = onboardingProgress(done);
    const hints: Partial<Record<OnboardingStepId, string>> = {};
    if (firstTask && workspace && done.includes('create-first-task'))
      hints['create-first-task'] = `${workspace.keyPrefix}-${firstTask.number} · ${firstTask.title}`;
    if (!done.includes('invite-teammates') && acceptedInvites === 1)
      hints['invite-teammates'] = '1 of 2 joined · one more to go';
    return {
      steps: progress.steps.map((s) => ({
        id: s.id,
        title: s.title,
        hint: hints[s.id] ?? s.hint,
        done: s.done,
        isNext: s.isNext,
      })),
      completed: progress.completed,
      total: progress.total,
      nextStep: progress.nextStep,
      isComplete: progress.isComplete,
      dismissed: !!stored.dismissedAt,
    };
  }

  templates(): ProjectTemplateDto[] {
    return PROJECT_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      sections: [...t.sections],
      taskCount: t.tasks.length,
      featured: !!t.featured,
    }));
  }
}
