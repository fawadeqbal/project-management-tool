import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionScope } from './transaction-scope';
import type { UnitOfWork } from './unit-of-work';

/** Generous: a template apply or sprint completion writes a few dozen rows. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/** Prisma adapter for the UnitOfWork port: one interactive transaction per outermost `run`. */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  private readonly logger = new Logger(PrismaUnitOfWork.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TransactionScope,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.scope.current()) return work(); // join the outer unit
    const { result, afterCommit } = await this.prisma.$transaction(
      (tx) => this.scope.within(tx, work),
      TX_OPTIONS,
    );
    for (const hook of afterCommit) {
      try {
        hook();
      } catch (e) {
        this.logger.error(`After-commit hook failed: ${e instanceof Error ? e.stack : String(e)}`);
      }
    }
    return result;
  }
}
