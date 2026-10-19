/**
 * Something that happened in the domain, named in the past tense. Events are plain data so they
 * can cross process boundaries (websocket broadcast, outbox) without serialization surprises.
 */
export interface DomainEvent<TType extends string = string, TPayload = Record<string, unknown>> {
  readonly type: TType;
  readonly occurredAt: Date;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly aggregateId: string;
  readonly payload: TPayload;
}

export const createEvent = <TType extends string, TPayload>(
  type: TType,
  base: { workspaceId: string; actorId: string; aggregateId: string; occurredAt: Date },
  payload: TPayload,
): DomainEvent<TType, TPayload> => ({ type, ...base, payload });
