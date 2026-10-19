/** Task status as the design system names it. */
export type Status = 'todo' | 'in-progress' | 'in-review' | 'blocked' | 'done';

/** Task priority as the design system names it. */
export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low' | 'none';

/** The seven accent hues; each has -bg, -fg, -dot and -avatar tokens. */
export type AccentColor = 'blue' | 'green' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';

export const ACCENT_COLORS: readonly AccentColor[] = ['blue', 'violet', 'green', 'amber', 'sky', 'rose', 'slate'];

/** Status values as the domain and API spell them. */
export type DomainStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE';

/** Priority values as the domain and API spell them. */
export type DomainPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  todo: 'To do',
  'in-progress': 'In progress',
  'in-review': 'In review',
  blocked: 'Blocked',
  done: 'Done',
};

export const PRIORITY_LABELS: Readonly<Record<PriorityLevel, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority',
};

const UI_STATUS: Readonly<Record<DomainStatus, Status>> = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  IN_REVIEW: 'in-review',
  BLOCKED: 'blocked',
  DONE: 'done',
};

const UI_PRIORITY: Readonly<Record<DomainPriority, PriorityLevel>> = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none',
};

export function toUiStatus(status: DomainStatus): Status {
  return UI_STATUS[status];
}

export function toUiPriority(priority: DomainPriority): PriorityLevel {
  return UI_PRIORITY[priority];
}

export function toDomainStatus(status: Status): DomainStatus {
  return (Object.keys(UI_STATUS) as DomainStatus[]).find((key) => UI_STATUS[key] === status) ?? 'TODO';
}

export function toDomainPriority(priority: PriorityLevel): DomainPriority {
  return (Object.keys(UI_PRIORITY) as DomainPriority[]).find((key) => UI_PRIORITY[key] === priority) ?? 'NONE';
}

/** CSS custom property reference for an accent token, e.g. `accentVar('blue', 'dot')`. */
export function accentVar(color: AccentColor, part: 'bg' | 'fg' | 'dot' | 'avatar'): string {
  return `var(--accent-${color}-${part})`;
}
