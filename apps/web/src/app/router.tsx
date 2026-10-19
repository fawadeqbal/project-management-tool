import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { publicRoutes, shellRoutes } from './feature-registry';
import { DocsPage, GoalsPage } from './pages/ComingSoonPage';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage';
import { ShellProviders } from './providers';
import { AppShell } from './shell/AppShell';
import type { RouteHandle } from '@/shared/routing/crumbs';

/** App-level routes that belong to no feature. */
const appRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/my-tasks" replace /> },
  { path: 'goals', element: <GoalsPage />, handle: { crumb: 'Goals' } satisfies RouteHandle },
  { path: 'docs', element: <DocsPage />, handle: { crumb: 'Docs' } satisfies RouteHandle },
  { path: '*', element: <NotFoundPage />, handle: { crumb: 'Not found' } satisfies RouteHandle },
];

export const routes: RouteObject[] = [
  {
    // Public pages share the error boundary but not the shell.
    errorElement: <RouteErrorPage />,
    children: publicRoutes,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <ShellProviders>
          <AppShell />
        </ShellProviders>
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [{ errorElement: <RouteErrorPage />, children: [...shellRoutes, ...appRoutes] }],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
