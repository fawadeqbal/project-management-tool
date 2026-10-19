import type { Actor } from '@hearth/domain';

export class CancelPlanCommand {
  constructor(
    readonly actor: Actor,
    readonly confirm: boolean,
  ) {}
}
