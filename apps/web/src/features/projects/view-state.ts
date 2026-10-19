import { useCallback } from 'react';
import { create } from 'zustand';
import type { TaskDto } from '@hearth/contracts';
import { isPriority, isTaskStatus, type Priority, type TaskStatus } from '@hearth/domain';

export type Swimlanes = 'none' | 'assignee' | 'priority';

/** Filters shared by every view of one project (Consistency): remembered per project. */
export interface ProjectFilters {
  statuses: TaskStatus[];
  priorities: Priority[];
  /** null = anyone, 'none' = unassigned. */
  assigneeId: string | null;
  swimlanes: Swimlanes;
}

export const DEFAULT_FILTERS: ProjectFilters = { statuses: [], priorities: [], assigneeId: null, swimlanes: 'none' };

const key = (projectId: string) => `hearth.project.filters.${projectId}`;

const load = (projectId: string): ProjectFilters => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key(projectId)) ?? 'null') as Partial<Record<keyof ProjectFilters, unknown>> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_FILTERS;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      statuses: strings(raw.statuses).filter(isTaskStatus),
      priorities: strings(raw.priorities).filter(isPriority),
      assigneeId: typeof raw.assigneeId === 'string' ? raw.assigneeId : null,
      swimlanes: raw.swimlanes === 'assignee' || raw.swimlanes === 'priority' ? raw.swimlanes : 'none',
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

interface FiltersState {
  byProject: Record<string, ProjectFilters>;
  set: (projectId: string, patch: Partial<ProjectFilters>) => void;
}

const useFiltersStore = create<FiltersState>((set) => ({
  byProject: {},
  set: (projectId, patch) =>
    set((s) => {
      const next = { ...(s.byProject[projectId] ?? load(projectId)), ...patch };
      try {
        window.localStorage.setItem(key(projectId), JSON.stringify(next));
      } catch {
        /* storage unavailable — filters still apply for this session */
      }
      return { byProject: { ...s.byProject, [projectId]: next } };
    }),
}));

/** `const { filters, setFilters } = useProjectFilters(projectId)` — shared by the filter bar and every view. */
export function useProjectFilters(projectId: string) {
  const stored = useFiltersStore((s) => s.byProject[projectId]);
  const setStore = useFiltersStore((s) => s.set);
  const filters = stored ?? load(projectId);
  const setFilters = useCallback((patch: Partial<ProjectFilters>) => setStore(projectId, patch), [setStore, projectId]);
  const activeCount = filters.statuses.length + filters.priorities.length + (filters.assigneeId ? 1 : 0);
  return { filters, setFilters, activeCount };
}

type Filterable = Pick<TaskDto, 'status' | 'priority' | 'assigneeId'>;

export const matchesProjectFilters = (task: Filterable, f: ProjectFilters): boolean => {
  if (f.statuses.length && !f.statuses.includes(task.status)) return false;
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  if (f.assigneeId === 'none' && task.assigneeId) return false;
  if (f.assigneeId && f.assigneeId !== 'none' && task.assigneeId !== f.assigneeId) return false;
  return true;
};

export const applyProjectFilters = <T extends Filterable>(tasks: readonly T[], f: ProjectFilters): T[] => tasks.filter((t) => matchesProjectFilters(t, f));

/** Reset (test helper and "Clear filters"). */
export const resetProjectFilters = () => useFiltersStore.setState({ byProject: {} });
