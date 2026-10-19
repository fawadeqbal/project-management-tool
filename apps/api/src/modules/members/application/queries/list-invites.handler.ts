import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { InviteDto } from '@hearth/contracts';
import { MembersReadModel } from '../../infrastructure/members.read-model';
import { ListInvitesQuery } from './list-invites.query';

@QueryHandler(ListInvitesQuery)
export class ListInvitesHandler implements IQueryHandler<ListInvitesQuery, InviteDto[]> {
  constructor(private readonly read: MembersReadModel) {}
  execute({ actor }: ListInvitesQuery) {
    return this.read.invites(actor);
  }
}
