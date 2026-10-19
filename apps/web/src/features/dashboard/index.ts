import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

/** Public surface of the "dashboard" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'dashboards',
    lazy: async () => ({ Component: (await import('./pages/DashboardPage')).DashboardPage }),
    handle: { crumb: 'Dashboards' } satisfies RouteHandle,
  },
];

/** "Go to Dashboards" (G D) is a core command; this feature adds no global ones beyond the page's own. */
export const commands: Command[] = [];
