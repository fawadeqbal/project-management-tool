import type { DomainEvent } from './domain-event';

/** Identity-based equality: two entities are the same when their ids match. */
export abstract class Entity<TProps, TId extends string = string> {
  protected constructor(
    readonly id: TId,
    protected props: TProps,
  ) {}

  equals(other?: Entity<TProps, TId>): boolean {
    return !!other && other.id === this.id;
  }
}

/**
 * Aggregate root: the only entry point for changing a consistency boundary. Behavior methods
 * enforce invariants and record domain events; the application layer publishes them after the
 * repository has persisted the aggregate (Observer pattern via an event bus).
 */
export abstract class AggregateRoot<TProps, TId extends string = string> extends Entity<TProps, TId> {
  private readonly pendingEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  /** Returns and clears recorded events. Call once, after a successful save. */
  pullEvents(): DomainEvent[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }

  get hasPendingEvents(): boolean {
    return this.pendingEvents.length > 0;
  }
}
