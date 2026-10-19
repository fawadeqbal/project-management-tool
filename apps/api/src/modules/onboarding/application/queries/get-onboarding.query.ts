import type { Actor } from '@hearth/domain';

export class GetOnboardingQuery {
  constructor(readonly actor: Actor) {}
}
