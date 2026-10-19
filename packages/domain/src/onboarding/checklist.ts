export const ONBOARDING_STEPS = [
  { id: 'create-workspace', title: 'Create your workspace', hint: 'Done in 20 seconds' },
  { id: 'start-from-template', title: 'Start from a template', hint: 'Templates beat the blank page' },
  { id: 'create-first-task', title: 'Create your first task', hint: 'Press C anywhere' },
  {
    id: 'invite-teammates',
    title: 'Invite 2 teammates',
    hint: 'Projects with 3+ people are far more likely to ship on time',
  },
  { id: 'connect-slack', title: 'Connect Slack', hint: 'Get updates where your team already talks' },
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

/**
 * Getting-started checklist (Zeigarnik effect): visible progress, done steps stay struck
 * through, and exactly one highlighted next step.
 */
export const onboardingProgress = (completed: readonly string[]) => {
  const steps = ONBOARDING_STEPS.map((s) => ({ ...s, done: completed.includes(s.id) }));
  const next = steps.find((s) => !s.done) ?? null;
  return {
    steps: steps.map((s) => ({ ...s, isNext: next?.id === s.id })),
    completed: steps.filter((s) => s.done).length,
    total: steps.length,
    nextStep: next ? next.title : null,
    isComplete: !next,
  };
};

/** Infers completed steps from facts, so the checklist never asks for something already done. */
export const inferOnboardingSteps = (facts: {
  tasksCreatedByUser: number;
  activeMembers: number;
  projectsFromTemplate: number;
  slackConnected: boolean;
}): OnboardingStepId[] => {
  const done: OnboardingStepId[] = ['create-workspace'];
  if (facts.projectsFromTemplate > 0) done.push('start-from-template');
  if (facts.tasksCreatedByUser > 0) done.push('create-first-task');
  if (facts.activeMembers >= 3) done.push('invite-teammates');
  if (facts.slackConnected) done.push('connect-slack');
  return done;
};
