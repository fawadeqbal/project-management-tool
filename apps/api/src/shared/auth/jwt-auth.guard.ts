import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, NO_WORKSPACE } from './auth.decorators';
import { TokenService } from './token.service';
import { ActorResolver } from '../workspace-context/actor-resolver.service';
import type { AuthenticatedRequest } from '../workspace-context/current-actor.decorator';

/**
 * Global guard: authenticates the bearer token, then resolves the workspace actor.
 * Every route is protected unless it opts out with @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly actors: ActorResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const { sub } = await this.tokens.verify(token);
    req.userId = sub;

    if (!this.reflector.getAllAndOverride<boolean>(NO_WORKSPACE, targets)) {
      const workspaceHeader = req.headers['x-workspace-id'];
      req.actor = await this.actors.resolve(
        sub,
        typeof workspaceHeader === 'string' ? workspaceHeader : null,
      );
    }
    return true;
  }
}
