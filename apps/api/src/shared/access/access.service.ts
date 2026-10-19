import { Injectable } from '@nestjs/common';
import { AccessPolicy, type Actor, type Permission } from '@hearth/domain';

/**
 * Thin injectable wrapper around the domain AccessPolicy (chain of responsibility), for
 * resource-level checks inside handlers: `access.assert(actor, 'tasks.edit', { projectId })`.
 */
@Injectable()
export class AccessService {
  private readonly policy = new AccessPolicy();

  allows(
    actor: Actor,
    permission: Permission,
    resource?: { projectId?: string | null; ownerId?: string },
  ): boolean {
    return this.policy.allows(actor, permission, resource);
  }

  assert(
    actor: Actor,
    permission: Permission,
    resource?: { projectId?: string | null; ownerId?: string },
  ): void {
    this.policy.assert(actor, permission, resource);
  }
}
