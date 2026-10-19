import type { Actor } from '@hearth/domain';

export class ResendInviteCommand {
  constructor(
    readonly actor: Actor,
    readonly inviteId: string,
  ) {}
}
