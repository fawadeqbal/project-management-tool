import type { RankBacklogInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class RankBacklogCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly input: RankBacklogInput,
  ) {}
}
