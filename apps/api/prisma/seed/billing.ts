import type { PrismaClient } from '@prisma/client';
import { day, type SeedContext } from './context';

const GB = 1024 ** 3;

/**
 * Billing, members and onboarding data from the Billing, Roles and Home designs:
 * Pro (monthly, 10 seats) renewing on the 1st, usage near the automation limit, three pending
 * invites, and Fawad's checklist at 3 of 5.
 */
export async function seedBilling(prisma: PrismaClient, ctx: SeedContext): Promise<void> {
  const { workspaceId, today } = ctx;
  const period = today.toISOString().slice(0, 7);
  const firstOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      plan: 'PRO',
      interval: 'MONTHLY',
      status: 'ACTIVE',
      seats: 10,
      renewsAt: firstOfNextMonth,
    },
    update: {
      plan: 'PRO',
      interval: 'MONTHLY',
      status: 'ACTIVE',
      seats: 10,
      renewsAt: firstOfNextMonth,
      pausedUntil: null,
    },
  });

  // 18 GB of files is unrealistic to create as Attachment rows; the read model uses max(counter, attachments).
  const counters: Array<[string, bigint]> = [
    ['automation_runs', 940n],
    ['ai_credits', 420n],
    ['storage_bytes', BigInt(18 * GB)],
  ];
  for (const [metric, value] of counters)
    await prisma.usageCounter.upsert({
      where: { workspaceId_metric_period: { workspaceId, metric, period } },
      create: { workspaceId, metric, period, value },
      update: { value },
    });

  const fawad = ctx.users.FI!;
  const sara = ctx.users.SA!;
  const invites = [
    {
      email: 'lena@acme.com',
      role: 'MEMBER' as const,
      teamId: ctx.teams.Design ?? null,
      projectId: null,
      invitedById: sara,
      sent: -2,
      token: 'seed-invite-lena',
    },
    {
      email: 'omar@acme.com',
      role: 'MEMBER' as const,
      teamId: ctx.teams.Engineering ?? null,
      projectId: null,
      invitedById: fawad,
      sent: -5,
      token: 'seed-invite-omar',
    },
    // Guests: shown as "expires in 2 days" (sent 5 days ago, 7-day expiry).
    {
      email: 'kate@northwind.co',
      role: 'GUEST' as const,
      teamId: null,
      projectId: ctx.projects.web ?? null,
      invitedById: fawad,
      sent: -5,
      token: 'seed-invite-kate',
    },
  ];
  for (const i of invites)
    await prisma.invite.create({
      data: {
        workspaceId,
        email: i.email,
        role: i.role,
        teamId: i.teamId,
        projectId: i.projectId,
        invitedById: i.invitedById,
        token: i.token,
        status: 'PENDING',
        createdAt: new Date(day(ctx, i.sent).getTime() + 10 * 3600_000),
        expiresAt: new Date(day(ctx, i.sent + 7).getTime() + 10 * 3600_000),
      },
    });

  await prisma.onboardingProgress.upsert({
    where: { workspaceId_userId: { workspaceId, userId: fawad } },
    create: {
      workspaceId,
      userId: fawad,
      completedSteps: ['create-workspace', 'start-from-template', 'create-first-task'],
    },
    update: {
      completedSteps: ['create-workspace', 'start-from-template', 'create-first-task'],
      dismissedAt: null,
    },
  });
}
