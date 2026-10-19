import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@hearth/domain';
import { AccessService } from './access.service';
import type { AuthenticatedRequest } from '../workspace-context/current-actor.decorator';

const REQUIRED_PERMISSION = 'hearth:requiredPermission';

/** Declares the role permission a route needs. Resource-level rules are checked in handlers. */
export const RequirePermission = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION, permission);

/** Global guard (runs after JwtAuthGuard) enforcing @RequirePermission via the domain policy. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!permission) return true;
    const { actor } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (actor) this.access.assert(actor, permission);
    return true;
  }
}
