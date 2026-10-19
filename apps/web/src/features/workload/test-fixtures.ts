import type { WorkloadCellDto, WorkloadDto, WorkloadPersonDto } from '@hearth/contracts';

const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
const labels = ['Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23'];

const cell = (
  date: string,
  planned: number | 'off',
  items: { taskId: string; amount: number }[] = [],
): WorkloadCellDto => {
  if (planned === 'off') return { date, planned: 0, capacity: 0, state: 'off', taskIds: [], items: [] };
  const state =
    planned > 8 ? 'over' : planned >= 8 ? 'full' : planned >= 4 ? 'normal' : planned > 0 ? 'light' : 'free';
  return { date, planned, capacity: 8, state, taskIds: items.map((i) => i.taskId), items };
};

const person = (id: string, name: string, initials: string, cells: WorkloadCellDto[]): WorkloadPersonDto => {
  const plannedTotal = cells.reduce((a, c) => a + c.planned, 0);
  const capacityTotal = cells.reduce((a, c) => a + c.capacity, 0);
  return {
    user: { id, name, initials, avatarColor: 'blue' },
    jobTitle: 'Engineer',
    capacityHoursPerDay: 8,
    cells,
    plannedTotal,
    capacityTotal,
    loadPct: Math.round((plannedTotal / capacityTotal) * 100),
    overDays: cells.filter((c) => c.state === 'over').map((c) => c.date),
  };
};

export const workloadFixture = (): WorkloadDto => ({
  range: { from: days[0]!, to: days[4]!, label: 'Oct 19 – Oct 23' },
  unit: 'hours',
  days: days.map((date, i) => ({ date, label: labels[i]!, isToday: i === 0, weekStart: false })),
  people: [
    person('mo', 'Mo Khan', 'MK', [
      cell(days[0]!, 8, [{ taskId: 't192', amount: 8 }]),
      cell(days[1]!, 9, [
        { taskId: 't192', amount: 8 },
        { taskId: 't195', amount: 1 },
      ]),
      cell(days[2]!, 11, [
        { taskId: 't192', amount: 8 },
        { taskId: 't195', amount: 3 },
      ]),
      cell(days[3]!, 4, [{ taskId: 't195', amount: 4 }]),
      cell(days[4]!, 2, [{ taskId: 't195', amount: 2 }]),
    ]),
    person('jia', 'Jia Li', 'JL', [
      cell(days[0]!, 5),
      cell(days[1]!, 6),
      cell(days[2]!, 0),
      cell(days[3]!, 'off'),
      cell(days[4]!, 'off'),
    ]),
    person('ravi', 'Ravi Teja', 'RT', [
      cell(days[0]!, 4),
      cell(days[1]!, 3),
      cell(days[2]!, 3),
      cell(days[3]!, 3),
      cell(days[4]!, 6),
    ]),
  ],
  tasks: {
    t192: {
      id: 't192',
      key: 'HRT-192',
      title: 'Build responsive navigation component',
      status: 'IN_PROGRESS',
      projectId: 'web',
      assigneeId: 'mo',
      estimateHours: 32,
      estimatePoints: 5,
      startDate: days[0]!,
      dueDate: days[3]!,
    },
    t195: {
      id: 't195',
      key: 'HRT-195',
      title: 'Set up analytics events',
      status: 'IN_PROGRESS',
      projectId: 'web',
      assigneeId: 'mo',
      estimateHours: 10,
      estimatePoints: 3,
      startDate: days[1]!,
      dueDate: days[4]!,
    },
  },
  summary: {
    capacityUsedPct: 81,
    planned: 87,
    capacity: 104,
    overCapacity: [
      {
        user: { id: 'mo', name: 'Mo Khan', initials: 'MK', avatarColor: 'blue' },
        days: [days[1]!, days[2]!],
        label: 'Tue–Wed',
      },
    ],
    freeCapacity: 30,
    freeBy: [{ user: { id: 'ravi', name: 'Ravi Teja', initials: 'RT', avatarColor: 'blue' }, free: 21 }],
    timeOff: [
      {
        user: { id: 'jia', name: 'Jia Li', initials: 'JL', avatarColor: 'blue' },
        days: [days[3]!, days[4]!],
        label: 'Thu 22 – Fri 23',
      },
    ],
  },
  suggestions: [
    {
      id: 't195:ravi',
      task: { id: 't195', key: 'HRT-195', title: 'Set up analytics events' },
      from: { id: 'mo', name: 'Mo Khan', initials: 'MK', avatarColor: 'blue' },
      to: { id: 'ravi', name: 'Ravi Teja', initials: 'RT', avatarColor: 'blue' },
      days: [days[1]!, days[2]!, days[3]!, days[4]!],
      dayLabel: 'Tue–Fri',
      hours: 10,
      fromLoadPct: 85,
      fromLoadPctAfter: 60,
      toLoadPct: 48,
      toLoadPctAfter: 73,
      reason: 'Mo is over capacity on Wed.',
      source: 'based on this week’s estimates',
    },
  ],
});
