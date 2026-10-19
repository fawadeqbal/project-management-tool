import type { UpdateSprintInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class UpdateSprintCommand {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
    readonly input: UpdateSprintInput,
  ) {}
}
