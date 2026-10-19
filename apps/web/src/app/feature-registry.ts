import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import * as auth from '@/features/auth';
import * as myTasks from '@/features/my-tasks';
import * as taskDetail from '@/features/task-detail';
import * as commandPalette from '@/features/command-palette';
import * as home from '@/features/home';
import * as projects from '@/features/projects';
import * as timeline from '@/features/timeline';
import * as calendar from '@/features/calendar';
import * as workload from '@/features/workload';
import * as sprints from '@/features/sprints';
import * as inbox from '@/features/inbox';
import * as dashboard from '@/features/dashboard';
import * as settings from '@/features/settings';
import * as billing from '@/features/billing';

/**
 * Registry of feature modules. Each feature exposes `routes` (rendered inside the app shell,
 * except auth) and `commands` (for ⌘K and shortcuts). Feature streams never edit this file.
 */
const appFeatures = [myTasks, taskDetail, commandPalette, home, projects, timeline, calendar, workload, sprints, inbox, dashboard, settings, billing];

export const publicRoutes: RouteObject[] = auth.routes;
export const shellRoutes: RouteObject[] = appFeatures.flatMap((f) => f.routes);
export const featureCommands: Command[] = [auth, ...appFeatures].flatMap((f) => f.commands);
