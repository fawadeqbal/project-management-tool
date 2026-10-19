import type { InboxQuery } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class GetInboxQuery {
  constructor(
    readonly actor: Actor,
    readonly query: InboxQuery,
  ) {}
}
