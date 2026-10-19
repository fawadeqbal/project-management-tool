import { diffInDays, parseDateOnly } from '../shared/dates';
import type { FilterableTask } from './task-view';
import { PRIORITY_META, PRIORITIES, STATUS_META, TASK_STATUSES } from './values';

export type GroupTone = 'danger' | 'brand' | 'neutral';

export interface TaskGroup<T extends FilterableTask = FilterableTask> {
  id: string;
  label: string;
  /** Hearth icon name for the group header. */
  icon?: string;
  /** For status groups the header shows the status icon. */
  status?: string;
  tone: GroupTone;
  collapsedByDefault: boolean;
  items: T[];
}

/**
 * Strategy pattern: "Group by" options are interchangeable algorithms behind one interface.
 * Adding a grouping (by sprint, by tag…) means adding a class — no existing code changes (OCP).
 */
export interface TaskGroupingStrategy {
  readonly id: GroupingId;
  readonly label: string;
  group<T extends FilterableTask>(
    tasks: readonly T[],
    ctx: { today: Date; projectNames?: Record<string, string>; userNames?: Record<string, string> },
  ): TaskGroup<T>[];
}

export type GroupingId = 'due' | 'status' | 'priority' | 'project' | 'assignee' | 'none';

const nonEmpty = <T extends FilterableTask>(groups: TaskGroup<T>[], keepEmpty: string[] = []) =>
  groups.filter((g) => g.items.length > 0 || keepEmpty.includes(g.id));

/** Overdue first (the only red), then Today, Upcoming (next 7 days), Later, No date. */
export class DueDateGrouping implements TaskGroupingStrategy {
  readonly id = 'due' as const;
  readonly label = 'Due date';
  group<T extends FilterableTask>(tasks: readonly T[], { today }: { today: Date }): TaskGroup<T>[] {
    const g = (
      id: string,
      label: string,
      icon: string,
      tone: GroupTone,
      collapsed = false,
    ): TaskGroup<T> => ({
      id,
      label,
      icon,
      tone,
      collapsedByDefault: collapsed,
      items: [],
    });
    const overdue = g('overdue', 'Overdue', 'clock', 'danger');
    const todayG = g('today', 'Today', 'star', 'brand');
    const upcoming = g('upcoming', 'Upcoming', 'calendar', 'neutral');
    const later = g('later', 'Later', 'clock', 'neutral', true);
    const noDate = g('no-date', 'No date', 'calendar', 'neutral', true);
    for (const t of tasks) {
      if (!t.dueDate) {
        noDate.items.push(t);
        continue;
      }
      const d = diffInDays(today, parseDateOnly(t.dueDate));
      if (d < 0 && t.status !== 'DONE') overdue.items.push(t);
      else if (d <= 0) todayG.items.push(t);
      else if (d <= 7) upcoming.items.push(t);
      else later.items.push(t);
    }
    return nonEmpty([overdue, todayG, upcoming, later, noDate], ['today']);
  }
}

export class StatusGrouping implements TaskGroupingStrategy {
  readonly id = 'status' as const;
  readonly label = 'Status';
  group<T extends FilterableTask>(tasks: readonly T[]): TaskGroup<T>[] {
    return nonEmpty(
      TASK_STATUSES.map((s) => ({
        id: s,
        label: STATUS_META[s].label,
        status: s,
        tone: 'neutral' as const,
        collapsedByDefault: s === 'DONE',
        items: tasks.filter((t) => t.status === s),
      })),
    );
  }
}

export class PriorityGrouping implements TaskGroupingStrategy {
  readonly id = 'priority' as const;
  readonly label = 'Priority';
  group<T extends FilterableTask>(tasks: readonly T[]): TaskGroup<T>[] {
    return nonEmpty(
      PRIORITIES.map((p) => ({
        id: p,
        label: PRIORITY_META[p].label,
        icon: 'flag',
        tone: p === 'URGENT' ? ('danger' as const) : ('neutral' as const),
        collapsedByDefault: false,
        items: tasks.filter((t) => t.priority === p),
      })),
    );
  }
}

class KeyGrouping implements TaskGroupingStrategy {
  constructor(
    readonly id: 'project' | 'assignee',
    readonly label: string,
    private readonly keyOf: (t: FilterableTask) => string | null,
    private readonly namesKey: 'projectNames' | 'userNames',
    private readonly emptyLabel: string,
    private readonly icon: string,
  ) {}
  group<T extends FilterableTask>(
    tasks: readonly T[],
    ctx: { projectNames?: Record<string, string>; userNames?: Record<string, string> },
  ): TaskGroup<T>[] {
    const map = new Map<string, T[]>();
    for (const t of tasks) {
      const k = this.keyOf(t) ?? '__none__';
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    const names = ctx[this.namesKey] ?? {};
    return [...map.entries()]
      .map(([k, items]) => ({
        id: k,
        label: k === '__none__' ? this.emptyLabel : (names[k] ?? 'Unknown'),
        icon: this.icon,
        tone: 'neutral' as const,
        collapsedByDefault: false,
        items,
      }))
      .sort((a, b) => (a.id === '__none__' ? 1 : b.id === '__none__' ? -1 : a.label.localeCompare(b.label)));
  }
}

export class NoGrouping implements TaskGroupingStrategy {
  readonly id = 'none' as const;
  readonly label = 'None';
  group<T extends FilterableTask>(tasks: readonly T[]): TaskGroup<T>[] {
    return [
      {
        id: 'all',
        label: 'All tasks',
        icon: 'list',
        tone: 'neutral',
        collapsedByDefault: false,
        items: [...tasks],
      },
    ];
  }
}

/** Registry (a tiny Factory) so callers pick a strategy by id. */
export const TASK_GROUPINGS: Record<GroupingId, TaskGroupingStrategy> = {
  due: new DueDateGrouping(),
  status: new StatusGrouping(),
  priority: new PriorityGrouping(),
  project: new KeyGrouping('project', 'Project', (t) => t.projectId, 'projectNames', 'No project', 'folder'),
  assignee: new KeyGrouping('assignee', 'Assignee', (t) => t.assigneeId, 'userNames', 'Unassigned', 'users'),
  none: new NoGrouping(),
};

// ── Sorting strategies ─────────────────────────────────────

export type SortId = 'priority' | 'due' | 'created' | 'manual' | 'title';

export interface TaskSortStrategy {
  readonly id: SortId;
  readonly label: string;
  compare(a: FilterableTask, b: FilterableTask): number;
}

const byDue = (a: FilterableTask, b: FilterableTask) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
const byPriority = (a: FilterableTask, b: FilterableTask) =>
  PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;

export const TASK_SORTS: Record<SortId, TaskSortStrategy> = {
  priority: { id: 'priority', label: 'Priority', compare: (a, b) => byPriority(a, b) || byDue(a, b) },
  due: { id: 'due', label: 'Due date', compare: (a, b) => byDue(a, b) || byPriority(a, b) },
  created: {
    id: 'created',
    label: 'Created',
    compare: (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  },
  manual: { id: 'manual', label: 'Manual', compare: (a, b) => (a.listPosition ?? 0) - (b.listPosition ?? 0) },
  title: { id: 'title', label: 'Title', compare: (a, b) => a.title.localeCompare(b.title) },
};

/** Group then sort inside each group — the full pipeline behind every list view. */
export const groupAndSort = <T extends FilterableTask>(
  tasks: readonly T[],
  grouping: GroupingId,
  sort: SortId,
  ctx: { today: Date; projectNames?: Record<string, string>; userNames?: Record<string, string> },
): TaskGroup<T>[] =>
  TASK_GROUPINGS[grouping]
    .group(tasks, ctx)
    .map((g) => ({ ...g, items: [...g.items].sort(TASK_SORTS[sort].compare) }));
