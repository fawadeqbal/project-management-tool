import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionScope } from './transaction-scope';

/**
 * Transaction-aware Prisma accessor for adapters. `client` is the active unit of work's
 * transaction, or the plain client outside one; `atomic` groups a few writes (joining the
 * active transaction, or opening its own) — use it instead of `prisma.$transaction([...])`,
 * which isn't available inside an interactive transaction.
 */
@Injectable()
export class PrismaDb {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TransactionScope,
  ) {}

  get client(): Prisma.TransactionClient {
    return this.scope.current()?.client ?? this.prisma;
  }

  atomic<T>(work: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const active = this.scope.current();
    return active ? work(active.client) : this.prisma.$transaction(work);
  }
}
