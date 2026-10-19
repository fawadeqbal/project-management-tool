import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { ApprovalDetailDto } from '@hearth/contracts';
import { ApprovalReadModel } from '../../infrastructure/approval.read-model';
import { GetApprovalQuery } from './get-approval.query';

@QueryHandler(GetApprovalQuery)
export class GetApprovalHandler implements IQueryHandler<GetApprovalQuery, ApprovalDetailDto> {
  constructor(private readonly read: ApprovalReadModel) {}
  execute({ actor, id }: GetApprovalQuery): Promise<ApprovalDetailDto> {
    return this.read.detail(actor, id);
  }
}
