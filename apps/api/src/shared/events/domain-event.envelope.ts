import type { DomainEvent } from '@hearth/domain';

/**
 * @nestjs/cqrs routes events by class. Domain events are plain data (so they can cross the
 * websocket), so every one travels in this single envelope class; subscribers filter by `type`.
 */
export class DomainEventEnvelope {
  constructor(readonly event: DomainEvent) {}
}
