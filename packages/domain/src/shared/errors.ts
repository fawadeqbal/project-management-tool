/**
 * Domain errors carry a stable machine-readable `code` and a human message written in the
 * Hearth voice (what happened, why, how to fix). Adapters map them to transport errors
 * (HTTP status, toast copy) without the domain knowing about either.
 */
export type DomainErrorKind =
  'validation' | 'not_found' | 'forbidden' | 'conflict' | 'limit_reached' | 'invariant';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  protected constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly kind = 'validation' as const;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found' as const;
  constructor(entity: string, id: string) {
    super(
      `${entity.toLowerCase()}.not_found`,
      `We couldn’t find that ${entity.toLowerCase()}. It may have been deleted or moved.`,
      {
        entity,
        id,
      },
    );
  }
}

export class ForbiddenError extends DomainError {
  readonly kind = 'forbidden' as const;
  constructor(
    code: string,
    message = 'You don’t have permission to do that. Ask a workspace admin for access.',
  ) {
    super(code, message);
  }
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict' as const;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class LimitReachedError extends DomainError {
  readonly kind = 'limit_reached' as const;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export class InvariantViolation extends DomainError {
  readonly kind = 'invariant' as const;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
