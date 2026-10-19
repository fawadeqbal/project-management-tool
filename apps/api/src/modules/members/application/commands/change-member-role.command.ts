import type { Actor, Role } from '@hearth/domain';

export class ChangeMemberRoleCommand {
  constructor(
    readonly actor: Actor,
    readonly userId: string,
    readonly role: Role,
  ) {}
}
