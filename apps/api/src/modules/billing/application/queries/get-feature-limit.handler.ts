import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { FeatureLimitDto } from '@hearth/contracts';
import { cheapestPlanWith, FEATURE_LABELS, FEATURES, ValidationError, type Feature } from '@hearth/domain';
import { PlanService } from '../../../../shared/billing/require-feature';
import { GetFeatureLimitQuery } from './get-feature-limit.query';

const isFeature = (v: string): v is Feature => (FEATURES as readonly string[]).includes(v);

/** What a locked feature does and which plan unlocks it — the contextual upgrade prompt. */
@QueryHandler(GetFeatureLimitQuery)
export class GetFeatureLimitHandler implements IQueryHandler<GetFeatureLimitQuery, FeatureLimitDto> {
  constructor(private readonly plans: PlanService) {}

  async execute({ actor, feature }: GetFeatureLimitQuery): Promise<FeatureLimitDto> {
    if (!isFeature(feature))
      throw new ValidationError(
        'billing.unknown_feature',
        `“${feature}” isn’t a Hearth feature. Check the link and try again.`,
      );
    const currentPlan = await this.plans.planOf(actor.workspaceId);
    const policy = await this.plans.policyFor(actor.workspaceId);
    const target = cheapestPlanWith(feature);
    return {
      feature,
      allowed: policy.hasFeature(feature),
      featureName: FEATURE_LABELS[feature].name,
      pitch: FEATURE_LABELS[feature].pitch,
      requiredPlan: target.id,
      requiredPlanName: target.name,
      currentPlan,
    };
  }
}
