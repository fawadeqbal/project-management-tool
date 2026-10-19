import { Logger } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { DomainEvent } from '@hearth/domain';
import type { DomainEventEnvelope } from './domain-event.envelope';

/**
 * Template method for reacting to domain events from another (or the same) context.
 *
 *   @EventsHandler(DomainEventEnvelope)
 *   export class NotifyOnMention extends DomainEventSubscriber {
 *     protected readonly types = ['comment.created'];
 *     protected async on(event: DomainEvent) { ... }
 *   }
 *
 * `types` entries ending in '.' match a prefix ('task.' = every task event) and '*' matches
 * every event. Failures are
 * logged and swallowed: a reaction must never break the write that caused it.
 */
export abstract class DomainEventSubscriber implements IEventHandler<DomainEventEnvelope> {
  protected abstract readonly types: readonly string[];
  protected readonly logger = new Logger(this.constructor.name);

  protected abstract on(event: DomainEvent): Promise<void> | void;

  /** Whether this subscriber cares about an event type. */
  matches(type: string): boolean {
    return this.types.some((t) => t === '*' || (t.endsWith('.') ? type.startsWith(t) : type === t));
  }

  async handle({ event }: DomainEventEnvelope): Promise<void> {
    if (!this.matches(event.type)) return;
    try {
      await this.on(event);
    } catch (e) {
      this.logger.error(
        `Failed handling ${event.type} for ${event.aggregateId}: ${e instanceof Error ? e.stack : String(e)}`,
      );
    }
  }
}
