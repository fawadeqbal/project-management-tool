import type { DashboardDto, ProjectHealthRowDto } from '@hearth/contracts';

const row = (over: Partial<ProjectHealthRowDto> & Pick<ProjectHealthRowDto, 'project'>): ProjectHealthRowDto => ({
  health: 'ON_TRACK',
  healthMeta: { label: 'On track', icon: 'status-done', tone: 'success' },
  suggestedHealth: 'ON_TRACK',
  suggestedReason: 'Progress is keeping pace with the schedule.',
  owner: { id: 'u1', name: 'Fawad Iqbal', initials: 'FI', avatarColor: 'blue' },
  progress: 50,
  totalTasks: 10,
  doneTasks: 5,
  due: '2026-11-14',
  budgetUsedPct: 50,
  budgetTone: 'normal',
  ...over,
});

export const dashboardFixture: DashboardDto = {
  title: 'Q4 portfolio',
  range: '6w',
  rangeLabel: 'last 6 weeks',
  projectCount: 3,
  kpis: [
    { label: 'Tasks completed', value: '251', delta: '+8%', deltaTone: 'good', sub: 'vs. previous 6 weeks' },
    { label: 'On-time delivery', value: '87%', delta: '+4 pts', deltaTone: 'good', sub: 'target 85%' },
    { label: 'Avg. cycle time', value: '3.4 days', delta: '−0.6', deltaTone: 'good', sub: 'lower is better' },
    { label: 'Overdue now', value: '9', delta: '+3', deltaTone: 'bad', sub: 'since last week' },
  ],
  throughput: [
    { label: 'Sep 14', weekStart: '2026-09-14', created: 41, completed: 36 },
    { label: 'Sep 21', weekStart: '2026-09-21', created: 38, completed: 40 },
  ],
  throughputVerdict: { text: 'Completed ≥ created for 1 of 2 weeks', tone: 'good', keptUp: 1, weeks: 2 },
  statusMix: [
    { status: 'TODO', label: 'To do', count: 38, pct: 48 },
    { status: 'IN_PROGRESS', label: 'In progress', count: 24, pct: 30 },
    { status: 'IN_REVIEW', label: 'In review', count: 11, pct: 14 },
    { status: 'BLOCKED', label: 'Blocked', count: 6, pct: 8 },
  ],
  blockedNote: '6 tasks blocked for more than 3 days — 4 of them in Mobile app v2.',
  projects: [
    row({
      project: { id: 'p1', name: 'Website relaunch', color: 'blue' },
      health: 'AT_RISK',
      healthMeta: { label: 'At risk', icon: 'alert', tone: 'warning' },
      progress: 62,
      due: '2026-11-14',
      budgetUsedPct: 71,
    }),
    row({ project: { id: 'p2', name: 'Q4 brand campaign', color: 'violet' }, owner: { id: 'u4', name: 'Jia Li', initials: 'JL', avatarColor: 'violet' }, progress: 48, due: '2026-12-05', budgetUsedPct: 44 }),
    row({
      project: { id: 'p3', name: 'Mobile app v2', color: 'sky' },
      health: 'OFF_TRACK',
      healthMeta: { label: 'Off track', icon: 'status-blocked', tone: 'danger' },
      owner: { id: 'u3', name: 'Mo Khan', initials: 'MK', avatarColor: 'sky' },
      progress: 35,
      due: '2026-11-28',
      budgetUsedPct: 93,
      budgetTone: 'danger',
    }),
  ],
  layout: ['kpis', 'throughput', 'status-mix', 'project-health'],
  schedule: null,
  generatedAt: new Date().toISOString(),
};
