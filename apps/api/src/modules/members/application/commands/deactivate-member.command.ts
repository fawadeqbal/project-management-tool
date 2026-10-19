import type { Actor } from '@hearth/domain';

export class DeactivateMemberCommand {
  constructor(
    readonly actor: Actor,
    readonly userId: string,
  ) {}
}
