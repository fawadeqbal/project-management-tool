import type { IconName } from '@hearth/ui';
import { isIconName } from '@hearth/ui';
import { PRIORITIES, PRIORITY_META, STATUS_META, TASK_STATUSES, type Priority, type TaskStatus } from '@hearth/domain';

/** Status → icon + token color, matching the design system's StatusIcon. */
export const STATUS_ICON: Record<TaskStatus, { icon: IconName; color: string }> = {
  TODO: { icon: 'status-todo', color: 'var(--status-todo)' },
  IN_PROGRESS: { icon: 'status-progress', color: 'var(--status-progress)' },
  IN_REVIEW: { icon: 'status-review', color: 'var(--status-review)' },
  BLOCKED: { icon: 'status-blocked', color: 'var(--status-blocked)' },
  DONE: { icon: 'status-done', color: 'var(--status-done)' },
};

export const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }));
export const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }));

export const statusLabel = (s: TaskStatus) => STATUS_META[s].label;
export const priorityLabel = (p: Priority) => PRIORITY_META[p].label;

/** Narrow a free-form icon string (Command.icon, group icons from the domain) to an IconName. */
export const asIcon = (name: string | undefined, fallback: IconName = 'list'): IconName =>
  name && isIconName(name) ? name : fallback;
