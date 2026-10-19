import type { PrismaClient } from '@prisma/client';
import { day, type SeedContext } from './context';

/** Design's actual burndown for Sprint 24 (remaining, scope) — the +4 is the scope change. */
const SPRINT24_LINE: Array<[remaining: number, scope: number]> = [
  [38, 38],
  [38, 38],
  [33, 38],
  [33, 38],
  [37, 42],
  [29, 42],
  [24, 42],
];

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/**
 * Fits the design's line to the working days from sprint start to today: plateau days (repeats)
 * drop first so the start, the scope change and today's value always survive.
 */
const fitLine = (line: typeof SPRINT24_LINE, days: number): typeof SPRINT24_LINE => {
  const out = [...line];
  while (out.length > days) {
    const plateau = out.findIndex(
      (v, i) => i > 0 && i < out.length - 1 && v[0] === out[i - 1]![0] && v[1] === out[i - 1]![1],
    );
    out.splice(plateau > 0 ? plateau : 1, 1);
  }
  while (out.length < days) out.splice(out.length - 1, 0, out[out.length - 2] ?? out[0]!);
  return out;
};

/**
 * Planning data (workload + sprints) for the designs, relative to today (= Mon Oct 19 in the designs):
 * Mobile app v2 sprints 21–23 completed, Sprint 24 active (Oct 13–26) with HRT-301..311 and its
 * burndown, Sprint 25 planned; Jia off Thu–Fri; 8h daily capacity for everyone.
 */
export async function seedPlanning(prisma: PrismaClient, ctx: SeedContext): Promise<void> {
  const projectId = ctx.projects['mobile'];
  if (!projectId) throw new Error('Seed planning: Mobile app v2 project missing');

  await prisma.membership.updateMany({
    where: { workspaceId: ctx.workspaceId },
    data: { capacityHoursPerDay: 8 },
  });

  // ── Completed history: two-week sprints ending before Sprint 24 starts ──
  const history: Array<[number, number, number]> = [
    // number, committed, completed
    [21, 36, 34],
    [22, 40, 40],
    [23, 42, 39],
  ];
  for (const [i, [number, committed, completed]] of history.entries()) {
    const offset = (history.length - i) * 14; // 42, 28, 14 days before Sprint 24's start
    const startDate = day(ctx, -6 - offset);
    const endDate = day(ctx, -6 - offset + 13);
    await prisma.sprint.create({
      data: {
        projectId,
        number,
        name: `Sprint ${number}`,
        goal:
          number === 23
            ? 'Swipe gestures and haptics prototype'
            : number === 22
              ? 'Beta crash-free sessions above 99%'
              : 'Offline storage spike and deep links',
        startDate,
        endDate,
        status: 'COMPLETED',
        committedPoints: committed,
        completedAt: new Date(endDate.getTime() + 17 * 3_600_000),
        snapshots: {
          create: [
            { date: startDate, remainingPoints: committed, scopePoints: committed },
            {
              date: day(ctx, -6 - offset + 7),
              remainingPoints: Math.round(committed / 2),
              scopePoints: committed,
            },
            { date: endDate, remainingPoints: committed - completed, scopePoints: committed },
          ],
        },
      },
    });
  }

  // ── Sprint 24: active, today-6 … today+7 ──
  const start = day(ctx, -6);
  const sprint24 = await prisma.sprint.create({
    data: {
      projectId,
      number: 24,
      name: 'Sprint 24',
      goal: 'Ship swipe actions and offline edits for beta',
      startDate: start,
      endDate: day(ctx, 7),
      status: 'ACTIVE',
      committedPoints: 38,
    },
  });
  const sprintTaskIds = Object.entries(ctx.tasks)
    .filter(([key]) => {
      const n = Number(key.split('-')[1]);
      return n >= 301 && n <= 311;
    })
    .map(([, id]) => id);
  await prisma.task.updateMany({
    where: { id: { in: sprintTaskIds } },
    data: { sprintId: sprint24.id, backlogRank: null },
  });

  const workingDays: Date[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = day(ctx, offset);
    if (!isWeekend(d)) workingDays.push(d);
  }
  const line = fitLine(SPRINT24_LINE, workingDays.length);
  await prisma.sprintSnapshot.createMany({
    data: workingDays.map((date, i) => ({
      sprintId: sprint24.id,
      date,
      remainingPoints: line[i]![0],
      scopePoints: line[i]![1],
    })),
  });

  // ── Sprint 25: planned, right after Sprint 24 ──
  await prisma.sprint.create({
    data: {
      projectId,
      number: 25,
      name: 'Sprint 25',
      goal: null,
      startDate: day(ctx, 8),
      endDate: day(ctx, 21),
      status: 'PLANNED',
    },
  });

  // ── Time off: Jia, Thu–Fri this week ──
  const jia = ctx.users['JL'];
  if (jia)
    await prisma.timeOff.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: jia,
        startDate: day(ctx, 3),
        endDate: day(ctx, 4),
        reason: 'Family visit',
      },
    });
}
