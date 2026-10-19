import type { Actor } from '@hearth/domain';

export class ResumeBillingCommand {
  constructor(readonly actor: Actor) {}
}
