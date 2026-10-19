import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Seats = active non-guest members (+ pending non-guest invites when checking a new invite). */
@Injectable()
export class SeatCounter {
  constructor(private readonly prisma: PrismaService) {}

  activeSeats(workspaceId: string): Promise<number> {
    return this.prisma.membership.count({ where: { workspaceId, status: 'ACTIVE', role: { not: 'GUEST' } } });
  }

  async committedSeats(workspaceId: string, now: Date): Promise<number> {
    const [active, pending] = await Promise.all([
      this.activeSeats(workspaceId),
      this.prisma.invite.count({ where: { workspaceId, status: 'PENDING', role: { not: 'GUEST' }, expiresAt: { gt: now } } }),
    ]);
    return active + pending;
  }
}
