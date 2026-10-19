import type { Actor } from '@hearth/domain';

export class ReactivateMemberCommand {
  constructor(
    readonly actor: Actor,
    readonly userId: string,
  ) {}
}
