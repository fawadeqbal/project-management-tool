import type { Params } from 'react-router-dom';

/**
 * Route `handle` convention. Every route rendered in the shell can declare a breadcrumb:
 *
 *   { path: '/projects/:projectId', handle: { crumb: 'Projects' } }
 *   { path: '/tasks/:key', handle: { crumb: ({ params }) => params.key ?? 'Task' } }
 *
 * The top bar joins the crumbs of every matched route with " / ".
 */
export interface CrumbArgs {
  params: Params<string>;
  data: unknown;
  pathname: string;
}
export type Crumb = string | ((args: CrumbArgs) => string | null | undefined);
export interface RouteHandle {
  crumb?: Crumb;
}

export const hasCrumb = (handle: unknown): handle is RouteHandle =>
  typeof handle === 'object' && handle !== null && 'crumb' in handle;

export const resolveCrumb = (crumb: Crumb, args: CrumbArgs): string | null => {
  const value = typeof crumb === 'function' ? crumb(args) : crumb;
  return value ? value : null;
};
