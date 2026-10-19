import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { InboxDto } from '@hearth/contracts';
import { InboxReadModel } from '../../infrastructure/inbox.read-model';
import { GetInboxQuery } from './get-inbox.query';

@QueryHandler(GetInboxQuery)
export class GetInboxHandler implements IQueryHandler<GetInboxQuery, InboxDto> {
  constructor(private readonly read: InboxReadModel) {}
  execute({ actor, query }: GetInboxQuery): Promise<InboxDto> {
    return this.read.list(actor, query);
  }
}
