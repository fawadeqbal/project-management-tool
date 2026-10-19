import type { ViewTab } from '@hearth/ui';

/** The project's views, in the order of the design (number keys 1–6 follow it). */
export const PROJECT_TABS: (ViewTab & { path: string })[] = [
  { id: 'overview', label: 'Overview', icon: 'home', path: 'overview' },
  { id: 'list', label: 'List', icon: 'list', path: 'list' },
  { id: 'board', label: 'Board', icon: 'board', path: 'board' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline', path: 'timeline' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-view', path: 'calendar' },
  { id: 'workload', label: 'Workload', icon: 'workload', path: 'workload' },
];

export const projectPath = (projectId: string, view = 'board') => `/projects/${projectId}/${view}`;

/** "Due Nov 14 · 62% complete" */
export const dueLine = (dueDate: string | null, progress: number): string => {
  const parts: string[] = [];
  if (dueDate) {
    const d = new Date(`${dueDate}T00:00:00Z`);
    parts.push(`Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`);
  }
  parts.push(`${progress}% complete`);
  return parts.join(' · ');
};
