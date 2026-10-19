import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

/** Public surface of the "home" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'home',
    lazy: async () => ({ Component: (await import('./pages/HomePage')).HomePage }),
    handle: { crumb: 'Home' } satisfies RouteHandle,
  },
];

/** "Go to Home" (G H) is a core command. */
export const commands: Command[] = [];
