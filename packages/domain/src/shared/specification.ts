/**
 * Specification pattern: a business rule as a composable, named predicate.
 * Used for task filters ("overdue AND assigned to me AND NOT done"), saved views and the
 * command palette, so the same rule is evaluated identically on the server and in the browser.
 */
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  /** Short, human description used in filter chips and saved-view summaries. */
  abstract describe(): string;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }

  filter(items: readonly T[]): T[] {
    return items.filter((i) => this.isSatisfiedBy(i));
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return this.left.isSatisfiedBy(c) && this.right.isSatisfiedBy(c);
  }
  describe(): string {
    return `${this.left.describe()} and ${this.right.describe()}`;
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return this.left.isSatisfiedBy(c) || this.right.isSatisfiedBy(c);
  }
  describe(): string {
    return `${this.left.describe()} or ${this.right.describe()}`;
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private readonly inner: Specification<T>) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return !this.inner.isSatisfiedBy(c);
  }
  describe(): string {
    return `not ${this.inner.describe()}`;
  }
}

/** Matches everything; the identity element for `and`. */
export class AnySpecification<T> extends Specification<T> {
  isSatisfiedBy(): boolean {
    return true;
  }
  describe(): string {
    return 'all';
  }
}

export const allOf = <T>(specs: Specification<T>[]): Specification<T> =>
  specs.reduce<Specification<T>>((acc, s) => acc.and(s), new AnySpecification<T>());
