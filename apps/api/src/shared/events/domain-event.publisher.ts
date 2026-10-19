import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import type { AggregateRoot, DomainEvent } from '@hearth/domain';
import { DomainEventEnvelope } from './domain-event.envelope';

/**
 * Publishes domain events after a successful write. Call `publishFrom(aggregate)` right after
 * `repository.save(aggregate)` so subscribers never observe uncommitted state.
 */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly bus: EventBus) {}

  publish(...events: DomainEvent[]): void {
    for (const event of events) this.bus.publish(new DomainEventEnvelope(event));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any aggregate's props shape
  publishFrom(...aggregates: AggregateRoot<any>[]): void {
    for (const a of aggregates) this.publish(...a.pullEvents());
  }
}
