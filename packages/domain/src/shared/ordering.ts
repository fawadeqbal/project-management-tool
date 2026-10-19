/**
 * Fractional ordering for drag-and-drop lists (board columns, backlog rank, subtasks):
 * moving an item writes one row instead of renumbering the whole list.
 */
export const positionBetween = (before: number | null | undefined, after: number | null | undefined): number => {
  if (before == null && after == null) return 1024;
  if (before == null) return (after as number) - 1024;
  if (after == null) return before + 1024;
  return (before + after) / 2;
};

/** Positions for appending `count` items after `last`. */
export const positionsAfter = (last: number | null | undefined, count: number): number[] =>
  Array.from({ length: count }, (_, i) => (last ?? 0) + (i + 1) * 1024);
