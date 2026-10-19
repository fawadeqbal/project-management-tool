import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

interface ActiveTransaction {
  client: Prisma.TransactionClient;
  afterCommit: Array<() => void>;
}

/**
 * The transaction (if any) the current async call chain runs in. One process-wide store so the
 * unit of work, the transaction-aware Prisma accessor and the event publisher agree.
 */
const storage = new AsyncLocalStorage<ActiveTransaction>();

@Injectable()
export class TransactionScope {
  current(): ActiveTransaction | undefined {
    return storage.getStore();
  }

  /** Runs `work` with `client` as the active transaction; returns the hooks to run after commit. */
  async within<T>(
    client: Prisma.TransactionClient,
    work: () => Promise<T>,
  ): Promise<{ result: T; afterCommit: Array<() => void> }> {
    const tx: ActiveTransaction = { client, afterCommit: [] };
    const result = await storage.run(tx, work);
    return { result, afterCommit: tx.afterCommit };
  }

  /** Queues `fn` until the active transaction commits. Returns false when there is none. */
  defer(fn: () => void): boolean {
    const tx = storage.getStore();
    if (!tx) return false;
    tx.afterCommit.push(fn);
    return true;
  }
}
