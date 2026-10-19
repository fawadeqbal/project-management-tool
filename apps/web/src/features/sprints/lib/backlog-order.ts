import type { RankBacklogInput, SprintTaskDto } from '@hearth/contracts';
import { positionBetween } from '@hearth/domain';

/** Neighbours for moving the item at `from` to index `to` (array semantics of arrayMove). */
export const neighboursFor = <T extends { id: string }>(items: readonly T[], from: number, to: number): { beforeId: string | null; afterId: string | null } => {
  const rest = items.filter((_, i) => i !== from);
  return { beforeId: rest[to - 1]?.id ?? null, afterId: rest[to]?.id ?? null };
};

/** Optimistic reorder: the same fractional rank the server will write. */
export const applyRank = (items: readonly SprintTaskDto[], input: RankBacklogInput): SprintTaskDto[] => {
  const moving = items.find((t) => t.id === input.taskId);
  if (!moving) return [...items];
  const before = items.find((t) => t.id === input.beforeId)?.backlogRank ?? null;
  const after = items.find((t) => t.id === input.afterId)?.backlogRank ?? null;
  const rank = positionBetween(before, after);
  return items
    .map((t) => (t.id === moving.id ? { ...t, backlogRank: rank } : t))
    .sort((a, b) => (a.backlogRank ?? Infinity) - (b.backlogRank ?? Infinity));
};
