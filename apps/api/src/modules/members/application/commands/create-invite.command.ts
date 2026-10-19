import type { CreateInviteInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class CreateInviteCommand {
  constructor(
    readonly actor: Actor,
    readonly input: CreateInviteInput,
  ) {}
}
