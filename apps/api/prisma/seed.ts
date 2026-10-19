import { PrismaClient } from '@prisma/client';
import { seedCore } from './seed/core';
import { seedPlanning } from './seed/planning';
import { seedInbox } from './seed/inbox';
import { seedBilling } from './seed/billing';

const prisma = new PrismaClient();

/** Every table, quoted as Prisma maps the models. One TRUNCATE ... CASCADE keeps the wipe FK-safe. */
const TABLES = [
  'User', 'Workspace', 'Membership', 'Team', 'TeamMember', 'Invite', 'Project', 'ProjectMember', 'Favorite',
  'Section', 'Milestone', 'MilestoneDependency', 'Task', 'Tag', 'TaskTag', 'TaskDependency', 'TaskFollower',
  'Comment', 'Attachment', 'Activity', 'SavedView', 'AiSuggestion', 'Sprint', 'SprintSnapshot', 'TimeOff',
  'Notification', 'ApprovalRequest', 'ApprovalDecision', 'Subscription', 'UsageCounter', 'OnboardingProgress',
];

async function main(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const ctx = await seedCore(prisma, today);
  await seedPlanning(prisma, ctx);
  await seedInbox(prisma, ctx);
  await seedBilling(prisma, ctx);

  const [users, projects, tasks] = await Promise.all([prisma.user.count(), prisma.project.count(), prisma.task.count()]);
  console.log(
    `Seeded Acme Studio (today=${today.toISOString().slice(0, 10)}): ${users} users, ${projects} projects, ${tasks} tasks.`,
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
