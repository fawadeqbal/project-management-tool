import type { NotificationType, PrismaClient } from '@prisma/client';
import { day, type SeedContext } from './context';

const must = (map: Record<string, string>, k: string): string => {
  const v = map[k];
  if (!v) throw new Error(`seedInbox: missing ${k}`);
  return v;
};

/**
 * Inbox from the design (Inbox.dc.html) for Fawad: Jia's approval request on "Homepage copy v3"
 * (Sara approved, Fawad pending, due tomorrow), and the seven notifications — three unread
 * today, two yesterday, two a few days back. New tasks take fresh numbers from Workspace.taskSeq.
 */
export async function seedInbox(prisma: PrismaClient, ctx: SeedContext): Promise<void> {
  const { workspaceId, users, projects, tasks, keyPrefix } = ctx;
  const FI = must(users, 'FI');
  const SA = must(users, 'SA');
  const MK = must(users, 'MK');
  const JL = must(users, 'JL');
  const RT = must(users, 'RT');
  const NB = must(users, 'NB');
  const now = new Date();
  const todayAt = (h: number, m: number) => {
    const d = new Date(
      Date.UTC(ctx.today.getUTCFullYear(), ctx.today.getUTCMonth(), ctx.today.getUTCDate(), h, m),
    );
    // Early in the (UTC) morning the design's times would be in the future — keep them in the past.
    return d.getTime() > now.getTime() ? new Date(now.getTime() - (9 * 60 + 60 - (h * 60 + m)) * 60_000) : d;
  };
  const dayAt = (offset: number, h: number, m = 0) =>
    new Date(day(ctx, offset).getTime() + (h * 60 + m) * 60_000);

  // ── New tasks with the next numbers ──
  const nextNumber = async () =>
    (
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { taskSeq: { increment: 1 } },
        select: { taskSeq: true },
      })
    ).taskSeq;
  const createTask = async (data: {
    title: string;
    project: string;
    assignee: string;
    creator: string;
    status: 'TODO' | 'IN_REVIEW';
    priority: 'HIGH' | 'MEDIUM';
    due: number;
    description?: string;
    createdAt: Date;
  }) => {
    const number = await nextNumber();
    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId: must(projects, data.project),
        number,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assignee,
        creatorId: data.creator,
        dueDate: day(ctx, data.due),
        estimateHours: 3,
        boardPosition: 9000 + number,
        listPosition: 9000 + number,
        createdAt: data.createdAt,
        followers: { create: [...new Set([data.assignee, data.creator])].map((userId) => ({ userId })) },
      },
    });
    const key = `${keyPrefix}-${number}`;
    tasks[key] = task.id;
    return { id: task.id, key };
  };

  const homepage = await createTask({
    title: 'Homepage copy v3 — ready for approval',
    project: 'brand',
    assignee: JL,
    creator: JL,
    status: 'IN_REVIEW',
    priority: 'HIGH',
    due: 1,
    description:
      'Third pass on the homepage copy for the relaunch: one-sentence hero, three outcomes instead of a feature list, pricing in its own section.',
    createdAt: dayAt(-3, 10),
  });
  await prisma.taskFollower.createMany({
    data: [
      { taskId: homepage.id, userId: FI },
      { taskId: homepage.id, userId: SA },
    ],
    skipDuplicates: true,
  });

  const offline = await createTask({
    title: 'Review offline sync copy before beta',
    project: 'mobile',
    assignee: FI,
    creator: MK,
    status: 'TODO',
    priority: 'MEDIUM',
    due: 3,
    createdAt: todayAt(8, 55),
  });

  // ── The approval request ──
  const approval = await prisma.approvalRequest.create({
    data: {
      taskId: homepage.id,
      requesterId: JL,
      title: 'Homepage copy v3 — ready for approval',
      summary:
        'Changes from v2: tightened the hero to one sentence, replaced the feature list with three outcomes, and moved pricing into its own section. Legal has signed off on the claims.',
      dueDate: day(ctx, 1),
      status: 'PENDING',
      createdAt: todayAt(9, 42),
      decisions: {
        create: [
          { userId: SA, decision: 'APPROVED', decidedAt: todayAt(9, 50) < now ? todayAt(9, 50) : now },
          { userId: FI, decision: 'PENDING' },
        ],
      },
      attachments: {
        create: [
          {
            name: 'Homepage copy v3',
            kind: 'doc',
            url: 'https://docs.acme.com/homepage-copy-v3',
            sizeBytes: 0,
            taskId: homepage.id,
          },
          {
            name: 'hero-v3.png',
            kind: 'file',
            url: 'https://files.acme.com/hero-v3.png',
            sizeBytes: Math.round(1.2 * 1024 * 1024),
            taskId: homepage.id,
          },
        ],
      },
    },
  });

  // ── Fawad's seven notifications (design order, newest first) ──
  const task = (key: string) => tasks[key] ?? null;
  const ctxLine = (project: string, key: string) => `${project} · ${key}`;
  const items: Array<{
    actor: string;
    type: NotificationType;
    title: string;
    context: string;
    excerpt: string;
    taskId: string | null;
    approvalId?: string;
    at: Date;
    unread: boolean;
  }> = [
    {
      actor: JL,
      type: 'APPROVAL_REQUESTED',
      title: 'Jia Li requested your approval',
      context: ctxLine('Q4 brand campaign', homepage.key),
      excerpt: 'Homepage copy v3 — ready for approval',
      taskId: homepage.id,
      approvalId: approval.id,
      at: todayAt(9, 42),
      unread: true,
    },
    {
      actor: SA,
      type: 'MENTION',
      title: 'Sara Ahmed mentioned you',
      context: ctxLine('Website relaunch', 'HRT-188'),
      excerpt:
        '@Fawad the annual toggle label is 3.9:1 in dark mode — can we move it to the secondary text token?',
      taskId: task('HRT-188'),
      at: todayAt(9, 10),
      unread: true,
    },
    {
      actor: MK,
      type: 'ASSIGNED',
      title: 'Mo Khan assigned you a task',
      context: ctxLine('Mobile app v2', offline.key),
      excerpt: 'Review offline sync copy before beta',
      taskId: offline.id,
      at: todayAt(8, 55),
      unread: true,
    },
    {
      actor: NB,
      type: 'STATUS_CHANGED',
      title: 'Nadia Bashir changed status to Blocked',
      context: ctxLine('Mobile app v2', 'HRT-171'),
      excerpt: 'QA mobile swipe gestures on Android — waiting on test devices',
      taskId: task('HRT-171'),
      at: dayAt(-1, 16, 20),
      unread: false,
    },
    {
      actor: RT,
      type: 'COMMENT_REPLY',
      title: 'Ravi Teja replied in a thread',
      context: ctxLine('Website relaunch', 'HRT-195'),
      excerpt: 'Events are named in snake_case now; dashboard picks them up tomorrow.',
      taskId: task('HRT-195'),
      at: dayAt(-1, 11, 5),
      unread: false,
    },
    {
      actor: SA,
      type: 'TASK_COMPLETED',
      title: 'Sara Ahmed completed a task you follow',
      context: ctxLine('Website relaunch', 'HRT-185'),
      excerpt: 'Accessibility pass on the signup flow',
      taskId: task('HRT-185'),
      at: dayAt(-2, 15, 30),
      unread: false,
    },
    {
      actor: JL,
      type: 'MENTION',
      title: 'Jia Li mentioned you',
      context: 'Docs · Brand voice guide',
      excerpt: '@Fawad can you confirm we say “workspace”, not “organization”?',
      taskId: null,
      at: dayAt(-3, 14, 10),
      unread: false,
    },
  ];
  await prisma.notification.createMany({
    data: items.map((n) => ({
      workspaceId,
      recipientId: FI,
      actorId: n.actor,
      type: n.type,
      taskId: n.taskId,
      approvalId: n.approvalId ?? null,
      title: n.title,
      context: n.context,
      excerpt: n.excerpt,
      createdAt: n.at,
      readAt: n.unread ? null : new Date(n.at.getTime() + 30 * 60_000),
    })),
  });

  // Ravi's reply exists on HRT-195 so the mention/reply pane has real context.
  const t195 = task('HRT-195');
  if (t195) {
    const parent = await prisma.comment.create({
      data: {
        taskId: t195,
        authorId: FI,
        body: 'Are the funnel events final? The dashboard needs stable names.',
        createdAt: dayAt(-1, 10, 30),
      },
    });
    await prisma.comment.create({
      data: {
        taskId: t195,
        authorId: RT,
        parentId: parent.id,
        body: 'Events are named in snake_case now; dashboard picks them up tomorrow.',
        createdAt: dayAt(-1, 11, 5),
      },
    });
  }

  // Sara gets Jia's request too (already decided), so her inbox isn't empty.
  await prisma.notification.create({
    data: {
      workspaceId,
      recipientId: SA,
      actorId: JL,
      type: 'APPROVAL_REQUESTED',
      taskId: homepage.id,
      approvalId: approval.id,
      title: 'Jia Li requested your approval',
      context: ctxLine('Q4 brand campaign', homepage.key),
      excerpt: 'Homepage copy v3 — ready for approval',
      createdAt: todayAt(9, 42),
      readAt: todayAt(9, 50) < now ? todayAt(9, 50) : now,
    },
  });
}
