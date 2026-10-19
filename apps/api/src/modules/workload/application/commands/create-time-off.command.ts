import type { CreateTimeOffInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class CreateTimeOffCommand {
  constructor(
    readonly actor: Actor,
    readonly input: CreateTimeOffInput,
  ) {}
}
