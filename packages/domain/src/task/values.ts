import { ValidationError } from '../shared/errors';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACCENT_COLORS = ['blue', 'green', 'sky', 'violet', 'amber', 'rose', 'slate'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

/** Display metadata — labels follow the Hearth voice (sentence case). */
export const STATUS_META: Record<TaskStatus, { label: string; order: number; isOpen: boolean }> = {
  TODO: { label: 'To do', order: 0, isOpen: true },
  IN_PROGRESS: { label: 'In progress', order: 1, isOpen: true },
  IN_REVIEW: { label: 'In review', order: 2, isOpen: true },
  BLOCKED: { label: 'Blocked', order: 3, isOpen: true },
  DONE: { label: 'Done', order: 4, isOpen: false },
};

/** Lower rank = more important. Used by "Sort: Priority". */
export const PRIORITY_META: Record<Priority, { label: string; rank: number }> = {
  URGENT: { label: 'Urgent', rank: 0 },
  HIGH: { label: 'High', rank: 1 },
  MEDIUM: { label: 'Medium', rank: 2 },
  LOW: { label: 'Low', rank: 3 },
  NONE: { label: 'No priority', rank: 4 },
};

export const isTaskStatus = (v: unknown): v is TaskStatus => (TASK_STATUSES as readonly unknown[]).includes(v);
export const isPriority = (v: unknown): v is Priority => (PRIORITIES as readonly unknown[]).includes(v);
export const isAccentColor = (v: unknown): v is AccentColor => (ACCENT_COLORS as readonly unknown[]).includes(v);

/**
 * TaskKey value object: "HRT-142". Immutable, validated, compared by value.
 */
export class TaskKey {
  private constructor(
    readonly prefix: string,
    readonly number: number,
  ) {}

  static of(prefix: string, number: number): TaskKey {
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(prefix))
      throw new ValidationError('task_key.prefix', 'Use 2–6 capital letters or digits for the key prefix, like HRT.');
    if (!Number.isInteger(number) || number < 1)
      throw new ValidationError('task_key.number', 'Task numbers start at 1.');
    return new TaskKey(prefix, number);
  }

  static parse(value: string): TaskKey {
    const m = /^([A-Z][A-Z0-9]{1,5})-(\d+)$/.exec(value.trim().toUpperCase());
    if (!m) throw new ValidationError('task_key.format', `“${value}” isn’t a task key — try something like HRT-142.`);
    return TaskKey.of(m[1]!, Number(m[2]));
  }

  equals(other: TaskKey): boolean {
    return this.prefix === other.prefix && this.number === other.number;
  }

  toString(): string {
    return `${this.prefix}-${this.number}`;
  }
}

/** Initials for avatars: "Fawad Iqbal" → "FI". */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : (parts[0]?.[1] ?? '');
  return (first + last).toUpperCase();
};
