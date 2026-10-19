import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitPolicy, PLANS, type Feature, type PlanId } from '@hearth/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../workspace-context/current-actor.decorator';

const REQUIRED_FEATURE = 'hearth:requiredFeature';

/**
 * Declares that a route needs a plan feature (e.g. 'sprints'). On a lower plan the request fails
 * with 402 `limit_reached`, naming what the feature does and which plan unlocks it — the web app
 * turns that into the contextual upgrade prompt. Put it on write routes; reads stay previewable.
 */
export const RequireFeature = (feature: Feature) => SetMetadata(REQUIRED_FEATURE, feature);

/** Looks up the workspace plan; shared so contexts don't depend on the billing module. */
@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async planOf(workspaceId: string): Promise<PlanId> {
    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId }, select: { plan: true } });
    return (sub?.plan ?? 'FREE') as PlanId;
  }

  async policyFor(workspaceId: string): Promise<PlanLimitPolicy> {
    return new PlanLimitPolicy(PLANS[await this.planOf(workspaceId)]);
  }
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plans: PlanService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(REQUIRED_FEATURE, [ctx.getHandler(), ctx.getClass()]);
    if (!feature) return true;
    const { actor } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (actor) (await this.plans.policyFor(actor.workspaceId)).assertFeature(feature);
    return true;
  }
}
