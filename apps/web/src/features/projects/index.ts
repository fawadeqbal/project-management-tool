import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { createElement, type ComponentType } from 'react';
import type { Command } from '@/shared/commands/command';
import { useUiStore } from '@/shared/layout/ui-store';
import type { RouteHandle } from '@/shared/routing/crumbs';
import { loadProjectCalendarPage } from '@/features/calendar';
import { loadProjectTimelinePage } from '@/features/timeline';
import { projectNameFor } from './api';
import { useProjectsUi } from './projects-ui';

const projectCrumb: RouteHandle['crumb'] = ({ params }) =>
  `Projects / ${projectNameFor(params.projectId) ?? 'Project'}`;

function ProjectIndexRedirect() {
  const { projectId } = useParams();
  return createElement(Navigate, { to: `/projects/${projectId}/board`, replace: true });
}

const page =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] });

/** Public surface of the "projects" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'projects',
    lazy: page(() => import('./pages/ProjectsPage'), 'ProjectsPage'),
    handle: { crumb: 'Projects' } satisfies RouteHandle,
  },
  {
    path: 'teams/:teamId',
    lazy: page(() => import('./pages/TeamPage'), 'TeamPage'),
    handle: { crumb: 'Teams' } satisfies RouteHandle,
  },
  {
    path: 'my-tasks/board',
    lazy: page(() => import('./pages/MyTasksBoardPage'), 'MyTasksBoardPage'),
    handle: { crumb: 'My tasks / Board' } satisfies RouteHandle,
  },
  {
    path: 'projects/:projectId',
    lazy: page(() => import('./pages/ProjectLayout'), 'ProjectLayout'),
    handle: { crumb: projectCrumb } satisfies RouteHandle,
    children: [
      { index: true, Component: ProjectIndexRedirect },
      {
        path: 'overview',
        lazy: page(() => import('./pages/ProjectOverviewPage'), 'ProjectOverviewPage'),
        handle: { crumb: 'Overview' } satisfies RouteHandle,
      },
      {
        path: 'list',
        lazy: page(() => import('./pages/ProjectListPage'), 'ProjectListPage'),
        handle: { crumb: 'List' } satisfies RouteHandle,
      },
      {
        path: 'board',
        lazy: page(() => import('./pages/ProjectBoardPage'), 'ProjectBoardPage'),
        handle: { crumb: 'Board' } satisfies RouteHandle,
      },
      // Timeline and Calendar views are owned by their features; they expose lazy page loaders.
      {
        path: 'timeline',
        lazy: async () => ({ Component: await loadProjectTimelinePage() }),
        handle: { crumb: 'Timeline' } satisfies RouteHandle,
      },
      {
        path: 'calendar',
        lazy: async () => ({ Component: await loadProjectCalendarPage() }),
        handle: { crumb: 'Calendar' } satisfies RouteHandle,
      },
    ],
  },
];

export const commands: Command[] = [
  {
    id: 'project.create',
    title: 'Create project',
    group: 'Actions',
    icon: 'folder',
    keywords: ['new project', 'add project', 'start'],
    run: () => useProjectsUi.getState().openCreate(),
  },
  {
    id: 'nav.projects',
    title: 'Go to Projects',
    group: 'Navigate',
    icon: 'folder',
    shortcut: ['G', 'P'],
    keywords: ['all projects', 'portfolio'],
    run: (c) => c.navigate('/projects'),
  },
  {
    id: 'nav.team',
    title: 'Go to team…',
    group: 'Navigate',
    icon: 'users',
    shortcut: ['G', 'T'],
    keywords: ['teams', 'people'],
    run: () => useUiStore.getState().openPalette({ scope: 'projects', query: 'Go to team' }),
  },
];

/** Mounted once by the app shell (dynamic "Go to project/team" commands + create-project dialog). */
export { ProjectsHost } from './components/ProjectsHost';
/** Reused by the timeline and calendar features through this index. */
export { useProject, useProjects, projectKeys } from './api';
export { useProjectContext, type ProjectOutletContext } from './pages/ProjectLayout';
export { ProjectFilterBar } from './components/ProjectFilterBar';
export { useProjectFilters, applyProjectFilters, matchesProjectFilters } from './view-state';
export { TaskBoard } from './components/board/TaskBoard';
