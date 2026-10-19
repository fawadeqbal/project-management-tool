import type { Actor } from '@hearth/domain';

export class GetMembersQuery {
  constructor(readonly actor: Actor) {}
}
