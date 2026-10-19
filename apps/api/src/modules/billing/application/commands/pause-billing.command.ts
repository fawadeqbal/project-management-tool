import type { Actor } from '@hearth/domain';

export class PauseBillingCommand {
  constructor(
    readonly actor: Actor,
    readonly months: 1 | 2 | 3,
  ) {}
}
