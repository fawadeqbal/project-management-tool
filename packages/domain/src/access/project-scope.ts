import { ForbiddenError, NotFoundError } from '../shared/errors';
import type { Role } from './roles';

/**
 * The one project-scope rule. Workspace staff (owner, admin, member, viewer) see every project;
 * guests see only the projects they were invited to. Anything outside a guest's scope is treated
 * as if it didn't exist (404, never 403) so hidden ids can't be confirmed by probing.
 */
export interface ScopedPrincipal {
  role: Role;
  /** Projects a guest was invited to. Ignored for every other role. */
  projectIds?: readonly string[];
}

export const isGuest = (who: Pick<ScopedPrincipal, 'role'>): boolean => who.role === 'GUEST';

/** Project ids the principal is limited to, or `null` when they see every project in the workspace. */
export const visibleProjectIds = (who: ScopedPrincipal): readonly string[] | null =>
  isGuest(who) ? [...(who.projectIds ?? [])] : null;

/**
 * Whether the principal can see something in `projectId`. `null` means "not in any project" —
 * staff can see those, guests can't (they only ever get their projects).
 */
export const canViewProject = (who: ScopedPrincipal, projectId: string | null | undefined): boolean => {
  if (!isGuest(who)) return true;
  return !!projectId && (who.projectIds ?? []).includes(projectId);
};

/** Guests never see the people directory, teams or other workspace-wide lists. */
export const canSeeWorkspaceDirectory = (who: Pick<ScopedPrincipal, 'role'>): boolean => !isGuest(who);

/**
 * Throws a 404 for `entity`/`id` when the principal can't see `projectId`. Pass the entity the
 * caller asked for ("Task", "Sprint"…) so the message matches what they were looking for.
 */
export const assertCanViewProject = (
  who: ScopedPrincipal,
  projectId: string | null | undefined,
  hidden: { entity: string; id: string },
): void => {
  if (!canViewProject(who, projectId)) throw new NotFoundError(hidden.entity, hidden.id);
};

/**
 * The error for a guest acting outside their scope: a 404 when they named a project they can't
 * see (so its existence isn't confirmed), a 403 when there is nothing to hide (no project).
 */
export const outOfScopeError = (projectId: string | null): NotFoundError | ForbiddenError =>
  projectId
    ? new NotFoundError('Project', projectId)
    : new ForbiddenError(
        'forbidden.guest_scope',
        'Guests can only work inside the projects they were invited to. Pick one of your projects.',
      );
