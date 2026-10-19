import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

/**
 * Public surface of the "calendar" feature: My tasks calendar here; the project calendar renders
 * inside the project frame (route owned by the projects feature) and is loaded lazily from here.
 */
export const routes: RouteObject[] = [
  {
    path: 'my-tasks/calendar',
    lazy: async () => ({ Component: (await import('./pages/MyTasksCalendarPage')).MyTasksCalendarPage }),
    handle: { crumb: 'My tasks / Calendar' } satisfies RouteHandle,
  },
];
export const commands: Command[] = [];

export const loadProjectCalendarPage = async (): Promise<ComponentType> =>
  (await import('./pages/ProjectCalendarPage')).ProjectCalendarPage;
