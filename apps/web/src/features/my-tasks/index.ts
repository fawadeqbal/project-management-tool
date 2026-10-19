import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';
import { MyTasksPage } from './pages/MyTasksPage';

/** Public surface of the "my-tasks" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  { path: 'my-tasks', Component: MyTasksPage, handle: { crumb: 'My tasks' } satisfies RouteHandle },
];

export const commands: Command[] = [
  {
    id: 'my-tasks.filter-overdue',
    title: 'Filter My tasks by: Overdue',
    group: 'Actions',
    icon: 'filter',
    shortcut: ['F', 'O'],
    keywords: ['late', 'past due'],
    run: (c) => c.navigate('/my-tasks?overdue=1'),
  },
  {
    id: 'my-tasks.due-today',
    title: 'Filter My tasks by: Due today',
    group: 'Actions',
    icon: 'filter',
    keywords: ['today'],
    run: (c) => c.navigate('/my-tasks?due=today'),
  },
];

/** The list/board/calendar tab set, for the board and calendar streams to reuse. */
export { MY_TASKS_TABS } from './pages/MyTasksPage';
