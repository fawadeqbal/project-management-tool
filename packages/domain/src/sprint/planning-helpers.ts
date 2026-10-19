import { PRIORITY_META, STATUS_META, type Priority, type TaskStatus } from '../task/values';

/** A task as sprint planning sees it. */
export interface SprintWorkItem {
  id: string;
  key?: string;
  status: TaskStatus;
  priority: Priority;
  points: number | null;
}

/** Today's burndown snapshot: remaining = points of open tasks, scope = every point in the sprint. */
export const sprintSnapshotOf = (items: readonly Pick<SprintWorkItem, 'status' | 'points'>[]): { remainingPoints: number; scopePoints: number } => ({
  remainingPoints: items.filter((t) => t.status !== 'DONE').reduce((a, t) => a + (t.points ?? 0), 0),
  scopePoints: items.reduce((a, t) => a + (t.points ?? 0), 0),
});

/**
 * When a sprint is over velocity, names the task to move back to the backlog: not yet started,
 * lowest priority first, and big enough to close the gap if one is (else the biggest).
 */
export const suggestDeferral = <T extends SprintWorkItem>(items: readonly T[], excessPoints: number): T | null => {
  if (excessPoints <= 0) return null;
  const candidates = items
    .filter((t) => t.status === 'TODO' && (t.points ?? 0) > 0)
    .sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || (b.points ?? 0) - (a.points ?? 0));
  if (!candidates.length) return null;
  const lowestRank = PRIORITY_META[candidates[0]!.priority].rank;
  const lowest = candidates.filter((t) => PRIORITY_META[t.priority].rank === lowestRank);
  const fits = lowest.filter((t) => (t.points ?? 0) >= excessPoints).sort((a, b) => (a.points ?? 0) - (b.points ?? 0))[0];
  return fits ?? lowest[0] ?? null;
};

/** Furthest along first: in review → in progress → blocked → to do; then priority, then size. */
const unfinishedOrder = (s: TaskStatus) => ({ IN_REVIEW: 0, IN_PROGRESS: 1, BLOCKED: 2, TODO: 3, DONE: 4 })[s];

export interface Retrospective<T> {
  completed: T[];
  unfinished: T[];
  completedPoints: number;
  unfinishedPoints: number;
  /** Completed points as a share of all points in the sprint at the end. */
  completionPct: number;
}

/**
 * The retrospective with unfinished work pre-sorted (Tesler's law: the product sorts it so the
 * team doesn't have to). Completed work keeps the order of status metadata, highest priority first.
 */
export const buildRetrospective = <T extends SprintWorkItem>(items: readonly T[]): Retrospective<T> => {
  const byPriority = (a: T, b: T) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || (b.points ?? 0) - (a.points ?? 0);
  const completed = items.filter((t) => !STATUS_META[t.status].isOpen).sort(byPriority);
  const unfinished = items.filter((t) => STATUS_META[t.status].isOpen).sort((a, b) => unfinishedOrder(a.status) - unfinishedOrder(b.status) || byPriority(a, b));
  const sum = (xs: T[]) => xs.reduce((a, t) => a + (t.points ?? 0), 0);
  const completedPoints = sum(completed);
  const unfinishedPoints = sum(unfinished);
  const total = completedPoints + unfinishedPoints;
  return { completed, unfinished, completedPoints, unfinishedPoints, completionPct: total ? Math.round((completedPoints / total) * 100) : 0 };
};

/** Ranks for putting `count` tasks at the top of a backlog whose best rank is `top`, keeping their order. */
export const ranksAtTop = (top: number | null | undefined, count: number): number[] =>
  Array.from({ length: count }, (_, i) => (top ?? 1024) - (count - i) * 1024);
