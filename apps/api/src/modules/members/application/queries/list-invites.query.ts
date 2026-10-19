import type { Actor } from '@hearth/domain';

export class ListInvitesQuery {
  constructor(readonly actor: Actor) {}
}
