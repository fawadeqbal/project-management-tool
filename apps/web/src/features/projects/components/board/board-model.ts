import type { TaskDto, TaskStatusDto, WipLimitsDto, WipLevelDto } from '@hearth/contracts';
import { positionBetween, STATUS_META, TASK_STATUSES, wipLevel, type Priority } from '@hearth/domain';

export interface BoardColumnModel {
  status: TaskStatusDto;
  label: string;
  tasks: TaskDto[];
  count: number;
  wipLimit: number | null;
  wipLevel: WipLevelDto;
}

export const byBoardPosition = (a: TaskDto, b: TaskDto) =>
  a.boardPosition - b.boardPosition || a.number - b.number;

/**
 * Columns per status, cards by boardPosition. Blocked only appears when something is blocked
 * (the design's four columns otherwise); `keep` forces a column to show (e.g. a drag target).
 */
export function buildColumns(
  tasks: readonly TaskDto[],
  wipLimits: WipLimitsDto = {},
  keep: TaskStatusDto[] = [],
): BoardColumnModel[] {
  return TASK_STATUSES.map((status) => {
    const items = tasks.filter((t) => t.status === status).sort(byBoardPosition);
    const limit = wipLimits[status] ?? null;
    return {
      status,
      label: STATUS_META[status].label,
      tasks: items,
      count: items.length,
      wipLimit: limit,
      wipLevel: wipLevel(items.length, limit),
    };
  }).filter((c) => c.status !== 'BLOCKED' || c.count > 0 || keep.includes('BLOCKED'));
}

/** "3" or "3 / 4 WIP", and whether it should read as a warning (amber, near or over). */
export function wipLabel(column: Pick<BoardColumnModel, 'count' | 'wipLimit' | 'wipLevel'>): {
  text: string;
  warn: boolean;
  description: string | undefined;
} {
  if (!column.wipLimit) return { text: String(column.count), warn: false, description: undefined };
  const warn = column.wipLevel !== 'ok';
  return {
    text: `${column.count} / ${column.wipLimit} WIP`,
    warn,
    description:
      column.wipLevel === 'over'
        ? 'Over the work-in-progress limit'
        : column.wipLevel === 'near'
          ? 'Near the work-in-progress limit'
          : undefined,
  };
}

/** Neighbours for the Tasks move API: `beforeId` = card directly above, `afterId` = card directly below. */
export interface Placement {
  status: TaskStatusDto;
  beforeId: string | null;
  afterId: string | null;
  /** The new boardPosition, for the optimistic cache patch. */
  position: number;
}

/** Placement for inserting `taskId` at `index` in `target` (the list should not contain the task). */
export function placeAt(
  target: readonly TaskDto[],
  index: number,
  status: TaskStatusDto,
  taskId: string,
): Placement {
  const list = target.filter((t) => t.id !== taskId);
  const i = Math.max(0, Math.min(list.length, index));
  const above = list[i - 1] ?? null;
  const below = list[i] ?? null;
  return {
    status,
    beforeId: above?.id ?? null,
    afterId: below?.id ?? null,
    position: positionBetween(above?.boardPosition ?? null, below?.boardPosition ?? null),
  };
}

/** Where the card currently sits (for Undo). */
export function currentPlacement(columns: readonly BoardColumnModel[], task: TaskDto): Placement {
  const column = columns.find((c) => c.status === task.status);
  const index = column ? column.tasks.findIndex((t) => t.id === task.id) : 0;
  return placeAt(column?.tasks ?? [], index, task.status, task.id);
}

export type KeyboardMove = 'left' | 'right' | 'up' | 'down' | 'top' | 'bottom';

/**
 * Keyboard alternative to dragging (Alt+←/→ between columns, Alt+↑/↓ within a column):
 * returns the placement, or null at an edge. Cross-column moves land at the bottom of the target.
 */
export function keyboardPlacement(
  columns: readonly BoardColumnModel[],
  task: TaskDto,
  move: KeyboardMove,
): Placement | null {
  const ci = columns.findIndex((c) => c.status === task.status);
  if (ci < 0) return null;
  const column = columns[ci]!;
  const index = column.tasks.findIndex((t) => t.id === task.id);
  if (move === 'left' || move === 'right') {
    const target = columns[ci + (move === 'left' ? -1 : 1)];
    if (!target) return null;
    return placeAt(target.tasks, target.tasks.length, target.status, task.id);
  }
  if (move === 'top') return index === 0 ? null : placeAt(column.tasks, 0, column.status, task.id);
  if (move === 'bottom')
    return index === column.tasks.length - 1
      ? null
      : placeAt(column.tasks, column.tasks.length, column.status, task.id);
  const to = index + (move === 'up' ? -1 : 1);
  if (to < 0 || to >= column.tasks.length) return null;
  return placeAt(column.tasks, to, column.status, task.id);
}

/** Placement for "Move to <status>" from the menu: bottom of that column. */
export function moveToStatus(
  columns: readonly BoardColumnModel[],
  task: TaskDto,
  status: TaskStatusDto,
): Placement {
  const target = columns.find((c) => c.status === status)?.tasks ?? [];
  return placeAt(target, target.length, status, task.id);
}

// ── Swimlanes ──

export interface Lane {
  id: string;
  label: string;
  tasks: TaskDto[];
}

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  NONE: 'No priority',
};
const PRIORITY_ORDER: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

export function buildLanes(tasks: readonly TaskDto[], by: 'none' | 'assignee' | 'priority'): Lane[] {
  if (by === 'none') return [{ id: 'all', label: 'All', tasks: [...tasks] }];
  if (by === 'priority')
    return PRIORITY_ORDER.map((p) => ({
      id: p,
      label: PRIORITY_LABEL[p],
      tasks: tasks.filter((t) => t.priority === p),
    })).filter((l) => l.tasks.length);
  const lanes = new Map<string, Lane>();
  for (const t of tasks) {
    const id = t.assigneeId ?? 'none';
    if (!lanes.has(id)) lanes.set(id, { id, label: t.assignee?.name ?? 'No assignee', tasks: [] });
    lanes.get(id)!.tasks.push(t);
  }
  return [...lanes.values()].sort((a, b) =>
    a.id === 'none' ? 1 : b.id === 'none' ? -1 : a.label.localeCompare(b.label),
  );
}
