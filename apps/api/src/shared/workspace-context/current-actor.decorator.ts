import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Actor } from '@hearth/domain';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  actor?: Actor;
}

/** Injects the resolved `Actor` (user + workspace + role) into a controller method. */
export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.actor) throw new InternalServerErrorException('No workspace context for this route. Did you mark it @NoWorkspace()?');
  return req.actor;
});

/** Injects only the authenticated user id (for @NoWorkspace routes). */
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.userId) throw new InternalServerErrorException('Route is not authenticated.');
  return req.userId;
});
