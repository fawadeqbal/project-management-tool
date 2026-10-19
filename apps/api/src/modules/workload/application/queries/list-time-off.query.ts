import type { TimeOffQuery } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class ListTimeOffQuery {
  constructor(
    readonly actor: Actor,
    readonly query: TimeOffQuery,
  ) {}
}
