import type { Actor } from '@hearth/domain';

export class RemoveMemberCommand {
  constructor(
    readonly actor: Actor,
    readonly userId: string,
    readonly confirmed: boolean,
  ) {}
}
