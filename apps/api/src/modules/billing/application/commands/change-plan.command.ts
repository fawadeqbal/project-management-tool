import type { ChangePlanInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class ChangePlanCommand {
  constructor(
    readonly actor: Actor,
    readonly input: ChangePlanInput,
  ) {}
}
