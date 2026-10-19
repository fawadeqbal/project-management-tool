import type { Actor } from '@hearth/domain';

export class UpdateCapacityCommand {
  constructor(
    readonly actor: Actor,
    readonly userId: string,
    readonly hoursPerDay: number,
  ) {}
}
