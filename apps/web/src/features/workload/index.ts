import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

const page = { lazy: async () => ({ Component: (await import('./pages/WorkloadPage')).WorkloadPage }) };

/** Public surface of the "workload" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  { path: 'workload', ...page, handle: { crumb: 'Workload' } satisfies RouteHandle },
  { path: 'projects/:projectId/workload', ...page, handle: { crumb: 'Workload' } satisfies RouteHandle },
];

export const commands: Command[] = [
  {
    id: 'workload.open',
    title: 'Open workload',
    group: 'Navigate',
    icon: 'workload',
    keywords: ['capacity', 'overloaded', 'team', 'time off', 'rebalance'],
    // In a project, open that project's workload; elsewhere, the whole team's.
    run: (c) => c.navigate(c.params.projectId ? `/projects/${c.params.projectId}/workload` : '/workload'),
  },
];

/** Linkable from dashboards and team pages. */
export const WORKLOAD_PATH = '/workload';
export const projectWorkloadPath = (projectId: string) => `/projects/${projectId}/workload`;
