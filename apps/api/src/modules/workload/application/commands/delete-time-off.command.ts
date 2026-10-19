import type { Actor } from '@hearth/domain';

export class DeleteTimeOffCommand {
  constructor(
    readonly actor: Actor,
    readonly id: string,
  ) {}
}
