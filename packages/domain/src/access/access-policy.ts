import { ForbiddenError } from '../shared/errors';
import { can, ROLE_META, type Permission, type Role } from './roles';
import { canViewProject, outOfScopeError } from './project-scope';

export interface Actor {
  userId: string;
  workspaceId: string;
  role: Role;
  /** Projects a guest was explicitly added to. Ignored for other roles. */
  projectIds?: readonly string[];
}

/**
 * Chain of Responsibility: each rule may allow, deny or pass to the next. New rules (e.g. a
 * project-archived rule, an IP allowlist) are added without touching existing ones.
 */
export type AccessDecision = 'allow' | 'deny' | 'pass';

export interface AccessRule {
  evaluate(
    actor: Actor,
    permission: Permission,
    resource?: { projectId?: string | null; ownerId?: string },
  ): AccessDecision;
}

/** Guests are confined to the projects they were invited to (see project-scope.ts). */
export class GuestProjectScopeRule implements AccessRule {
  evaluate(actor: Actor, _p: Permission, resource?: { projectId?: string | null }): AccessDecision {
    if (resource?.projectId === undefined) return 'pass';
    return canViewProject(actor, resource.projectId) ? 'pass' : 'deny';
  }
}

/** The role matrix is the final word. */
export class RoleMatrixRule implements AccessRule {
  evaluate(actor: Actor, permission: Permission): AccessDecision {
    return can(actor.role, permission) ? 'allow' : 'deny';
  }
}

export class AccessPolicy {
  constructor(
    private readonly rules: readonly AccessRule[] = [new GuestProjectScopeRule(), new RoleMatrixRule()],
  ) {}

  allows(
    actor: Actor,
    permission: Permission,
    resource?: { projectId?: string | null; ownerId?: string },
  ): boolean {
    for (const rule of this.rules) {
      const decision = rule.evaluate(actor, permission, resource);
      if (decision !== 'pass') return decision === 'allow';
    }
    return false;
  }

  /**
   * Throws when the actor may not act. Out-of-scope guests get the project-scope error (404 for a
   * named project, so hidden ids can't be confirmed); everyone else gets a 403 naming their role.
   */
  assert(
    actor: Actor,
    permission: Permission,
    resource?: { projectId?: string | null; ownerId?: string },
  ): void {
    if (resource?.projectId !== undefined && !canViewProject(actor, resource.projectId))
      throw outOfScopeError(resource.projectId);
    if (!this.allows(actor, permission, resource))
      throw new ForbiddenError(
        `forbidden.${permission}`,
        `${ROLE_META[actor.role].label}s can’t do that here. Ask a workspace admin if you need access.`,
      );
  }
}

/** Members can't hand out a role above their own; only owners create owners. */
export const assertCanAssignRole = (actorRole: Role, targetRole: Role): void => {
  if (ROLE_META[targetRole].rank < ROLE_META[actorRole].rank)
    throw new ForbiddenError(
      'roles.escalation',
      `Only an ${ROLE_META[targetRole].label.toLowerCase()} or higher can give someone that role.`,
    );
};
