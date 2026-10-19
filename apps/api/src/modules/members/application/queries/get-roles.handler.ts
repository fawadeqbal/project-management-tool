import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { RolesDto } from '@hearth/contracts';
import { MembersReadModel } from '../../infrastructure/members.read-model';
import { GetRolesQuery } from './get-roles.query';

@QueryHandler(GetRolesQuery)
export class GetRolesHandler implements IQueryHandler<GetRolesQuery, RolesDto> {
  constructor(private readonly read: MembersReadModel) {}
  execute(): Promise<RolesDto> {
    return Promise.resolve(this.read.roles());
  }
}
