import type { ProjectHealthRowDto } from '@hearth/contracts';

export type HealthSortKey = 'project' | 'health' | 'owner' | 'progress' | 'due' | 'budget';
export interface HealthSort {
  key: HealthSortKey;
  dir: 'asc' | 'desc';
}

const HEALTH_RANK = { OFF_TRACK: 0, AT_RISK: 1, ON_TRACK: 2 } as const;

const value = (r: ProjectHealthRowDto, key: HealthSortKey): string | number => {
  switch (key) {
    case 'project':
      return r.project.name.toLowerCase();
    case 'health':
      return HEALTH_RANK[r.health];
    case 'owner':
      return r.owner.name.toLowerCase();
    case 'progress':
      return r.progress;
    case 'due':
      return r.due ?? '9999-12-31';
    case 'budget':
      return r.budgetUsedPct ?? -1;
  }
};

/** Pure, stable sort for the project health table (worst health first when ascending). */
export const sortHealthRows = (rows: readonly ProjectHealthRowDto[], sort: HealthSort | null): ProjectHealthRowDto[] => {
  if (!sort) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = value(a.r, sort.key);
      const vb = value(b.r, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sign || a.i - b.i;
    })
    .map((x) => x.r);
};
