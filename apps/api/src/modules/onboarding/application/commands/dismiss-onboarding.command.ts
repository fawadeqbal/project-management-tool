import type { Actor } from '@hearth/domain';

export class DismissOnboardingCommand {
  constructor(readonly actor: Actor) {}
}
