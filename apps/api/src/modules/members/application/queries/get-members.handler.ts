import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { MembersOverviewDto } from '@hearth/contracts';
import { MembersReadModel } from '../../infrastructure/members.read-model';
import { GetMembersQuery } from './get-members.query';

@QueryHandler(GetMembersQuery)
export class GetMembersHandler implements IQueryHandler<GetMembersQuery, MembersOverviewDto> {
  constructor(private readonly read: MembersReadModel) {}
  execute({ actor }: GetMembersQuery) {
    return this.read.overview(actor);
  }
}
