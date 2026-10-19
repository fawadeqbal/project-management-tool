import type { Actor } from '@hearth/domain';

export class RevokeInviteCommand {
  constructor(
    readonly actor: Actor,
    readonly inviteId: string,
  ) {}
}
