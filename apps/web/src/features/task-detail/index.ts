import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';
import { TaskPage } from './pages/TaskPage';

/** Public surface of the "task-detail" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'tasks/:key',
    Component: TaskPage,
    handle: { crumb: ({ params }) => `Tasks / ${(params.key ?? '').toUpperCase()}` } satisfies RouteHandle,
  },
];
export const commands: Command[] = [];

/** The ?task=KEY side panel, mounted once by the app shell. */
export { TaskPanelHost } from './components/TaskPanelHost';
export { TaskDetailView, type TaskDetailViewProps } from './components/TaskDetailView';
