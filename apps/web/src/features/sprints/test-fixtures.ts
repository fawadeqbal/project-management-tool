import type { SprintDetailDto, SprintSummaryDto, SprintTaskDto } from '@hearth/contracts';

const u = (id: string, name: string, initials: string) => ({ id, name, initials, avatarColor: 'sky' as const });

export const sprintTask = (n: number, over: Partial<SprintTaskDto> = {}): SprintTaskDto => ({
  id: `t${n}`,
  key: `HRT-${n}`,
  title: `Task ${n}`,
  status: 'TODO',
  priority: 'MEDIUM',
  points: 3,
  assignee: u('mo', 'Mo Khan', 'MK'),
  epic: null,
  sprintId: 's24',
  backlogRank: null,
  ...over,
});

const summary = (n: number, status: SprintSummaryDto['status'], completed: number): SprintSummaryDto => ({
  id: `s${n}`,
  projectId: 'p1',
  number: n,
  name: `Sprint ${n}`,
  goal: n === 24 ? 'Ship swipe actions and offline edits for beta' : null,
  status,
  startDate: '2026-10-13',
  endDate: '2026-10-26',
  committedPoints: n === 24 ? 38 : completed,
  completedPoints: completed,
  scopePoints: n === 24 ? 42 : completed,
  taskCount: 8,
  completedAt: null,
});

export const sprintList = (): SprintSummaryDto[] => [summary(23, 'COMPLETED', 39), summary(24, 'ACTIVE', 18), summary(25, 'PLANNED', 0)];

const days = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26'];
const actual = [38, 38, 33, 33, 37, 29, 24];

export const sprintDetail = (): SprintDetailDto => ({
  sprint: summary(24, 'ACTIVE', 18),
  header: { dateLabel: 'Oct 13 – Oct 26', daysLeft: 3, statusLabel: 'Active · 3 working days left', people: [u('mo', 'Mo Khan', 'MK')] },
  tasks: [
    sprintTask(301, { title: 'Swipe right to complete a task', status: 'DONE', points: 5, priority: 'HIGH' }),
    sprintTask(306, { title: 'Offline queue for task edits', status: 'IN_PROGRESS', points: 8, priority: 'URGENT' }),
    sprintTask(311, { title: 'Background refresh for Inbox', points: 8 }),
  ],
  progress: { donePoints: 18, totalPoints: 42, donePct: 43 },
  burndown: {
    days,
    totalDays: 9,
    ideal: days.map((date, day) => ({ date, day, remaining: Math.round(((38 * (9 - day)) / 9) * 10) / 10 })),
    actual: actual.map((remaining, day) => ({ date: days[day]!, day, remaining })),
    scopeChanges: [{ date: days[4]!, day: 4, addedPoints: 4, remaining: 37 }],
    todayIndex: 6,
    onPace: false,
    behindBy: 9,
    projectedFinishDay: 12,
    daysLeft: 3,
    maxPoints: 42,
  },
  velocity: {
    bars: [
      { sprintId: 's21', number: 21, label: 'S21', points: 34, isPlan: false },
      { sprintId: 's22', number: 22, label: 'S22', points: 40, isPlan: false },
      { sprintId: 's23', number: 23, label: 'S23', points: 39, isPlan: false },
      { sprintId: 's24', number: 24, label: 'S24', points: 42, isPlan: true },
    ],
    average: 38,
  },
  capacity: {
    committed: 42,
    velocity: 38,
    level: 'over',
    ratio: 1.11,
    message: 'Committed 4 points above your 3-sprint average. Consider moving HRT-311 back to the backlog.',
    deferTask: { id: 't311', key: 'HRT-311', title: 'Background refresh for Inbox', points: 8 },
  },
  scopeChanges: [{ date: days[4]!, label: 'Oct 19 · +4 pts', addedPoints: 4 }],
  sprints: sprintList(),
});

export const backlogFixture = (): SprintTaskDto[] => [
  sprintTask(320, { title: 'Widget for today’s tasks (iOS)', sprintId: null, backlogRank: 1, points: 8, epic: 'Widgets', assignee: null }),
  sprintTask(322, { title: 'Quick add from share sheet', sprintId: null, backlogRank: 2, points: 5, epic: 'Capture', assignee: null }),
  sprintTask(324, { title: 'Push notification grouping', sprintId: null, backlogRank: 3, points: 3, epic: 'Notifications', assignee: null }),
];
