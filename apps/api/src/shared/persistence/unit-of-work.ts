/**
 * Port: runs a use case's writes as one unit — all of them commit or none do. Handlers depend on
 * this token, never on Prisma; the Prisma adapter opens an interactive transaction that every
 * transaction-aware adapter (`PrismaDb.client`) joins, and domain events published inside the
 * unit are held back until it commits (subscribers never see rolled-back state).
 *
 *   await this.uow.run(async () => { await repo.save(a); await store.move(b); });
 *
 * Nested `run` calls join the outer unit.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
/** Alias kept for readability where "transaction runner" reads better than "unit of work". */
export const TRANSACTION_RUNNER = UNIT_OF_WORK;

/** For handler unit tests (in-memory adapters have nothing to roll back). */
export const immediateUnitOfWork: UnitOfWork = { run: (work) => work() };
