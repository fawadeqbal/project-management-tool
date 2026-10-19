import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { BillingDto } from '@hearth/contracts';
import { BillingReadModel } from '../../infrastructure/billing.read-model';
import { GetBillingQuery } from './get-billing.query';

@QueryHandler(GetBillingQuery)
export class GetBillingHandler implements IQueryHandler<GetBillingQuery, BillingDto> {
  constructor(private readonly read: BillingReadModel) {}
  execute({ actor }: GetBillingQuery) {
    return this.read.get(actor);
  }
}
