import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

/** Public surface of the "sprints" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'projects/:projectId/sprints',
    lazy: async () => ({ Component: (await import('./pages/SprintPage')).SprintPage }),
    handle: { crumb: 'Sprints' } satisfies RouteHandle,
  },
];

export const commands: Command[] = [
  {
    id: 'sprints.open',
    title: 'Open sprint',
    group: 'Navigate',
    icon: 'zap',
    keywords: ['sprint', 'burndown', 'backlog', 'velocity'],
    isAvailable: (c) => !!c.params.projectId,
    run: (c) => c.navigate(`/projects/${c.params.projectId}/sprints`),
  },
];

/** Plan gating UX, shared with other paid features (workload). */
export { PlanGateDialog, UpgradeBanner, handlePlanLimit } from './plan-gate';

/** Adapts a planning read model to the TaskDto the shared task mutations expect. */
export { taskStub } from './lib/task-stub';
