import { Injectable } from '@nestjs/common';
import { periodKey, type Meter } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Current-period usage per meter, from live tables (seats, attachments) and UsageCounter rows. */
@Injectable()
export class UsageReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(workspaceId: string, now: Date): Promise<Record<Meter, number>> {
    const period = periodKey(now);
    const [seats, attachments, counters, storedStorage] = await Promise.all([
      this.prisma.membership.count({ where: { workspaceId, status: 'ACTIVE', role: { not: 'GUEST' } } }),
      this.prisma.attachment.aggregate({
        _sum: { sizeBytes: true },
        where: { OR: [{ task: { workspaceId } }, { approval: { task: { workspaceId } } }] },
      }),
      this.prisma.usageCounter.findMany({ where: { workspaceId, period } }),
      // Storage is cumulative, so the latest stored figure counts even from an earlier period.
      this.prisma.usageCounter.findFirst({ where: { workspaceId, metric: 'storage_bytes' }, orderBy: { period: 'desc' } }),
    ]);
    const counter = (metric: string) => Number(counters.find((c) => c.metric === metric)?.value ?? 0n);
    return {
      seats,
      storage_bytes: Math.max(Number(storedStorage?.value ?? 0n), attachments._sum.sizeBytes ?? 0),
      automation_runs: counter('automation_runs'),
      ai_credits: counter('ai_credits'),
    };
  }
}
