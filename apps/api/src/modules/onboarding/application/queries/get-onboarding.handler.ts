import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { OnboardingDto } from '@hearth/contracts';
import { OnboardingReadModel } from '../../infrastructure/onboarding.read-model';
import { GetOnboardingQuery } from './get-onboarding.query';

@QueryHandler(GetOnboardingQuery)
export class GetOnboardingHandler implements IQueryHandler<GetOnboardingQuery, OnboardingDto> {
  constructor(private readonly read: OnboardingReadModel) {}
  execute({ actor }: GetOnboardingQuery) {
    return this.read.get(actor);
  }
}
