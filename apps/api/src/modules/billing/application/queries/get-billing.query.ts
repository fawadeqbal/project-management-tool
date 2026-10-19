import type { Actor } from '@hearth/domain';

export class GetBillingQuery {
  constructor(readonly actor: Actor) {}
}
