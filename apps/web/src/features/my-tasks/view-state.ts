import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isPriority, isTaskStatus, type GroupingId, type Priority, type SortId, type TaskFilter, type TaskStatus } from '@hearth/domain';
import { useAuthStore } from '@/shared/auth/auth-store';

/** Saved view “My focus”: what My tasks remembers between visits. */
export interface MyTasksView {
  statuses: TaskStatus[];
  priorities: Priority[];
  projectIds: string[];
  overdueOnly: boolean;
  includeDone: boolean;
  grouping: Extract<GroupingId, 'due' | 'status' | 'priority' | 'project'>;
  sort: Extract<SortId, 'priority' | 'due' | 'created' | 'title'>;
}

export const DEFAULT_VIEW: MyTasksView = {
  statuses: [],
  priorities: [],
  projectIds: [],
  overdueOnly: false,
  includeDone: false,
  grouping: 'due',
  sort: 'priority',
};

export const GROUPINGS: { id: MyTasksView['grouping']; label: string }[] = [
  { id: 'due', label: 'Due date' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'project', label: 'Project' },
];

export const SORTS: { id: MyTasksView['sort']; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'created', label: 'Created' },
  { id: 'title', label: 'Title' },
];

const storageKey = (userId: string | undefined) => `hearth.myTasks.view.${userId ?? 'anon'}`;

const sanitize = (raw: unknown): MyTasksView => {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_VIEW;
  const r = raw as Partial<Record<keyof MyTasksView, unknown>>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    statuses: strings(r.statuses).filter(isTaskStatus),
    priorities: strings(r.priorities).filter(isPriority),
    projectIds: strings(r.projectIds),
    overdueOnly: r.overdueOnly === true,
    includeDone: r.includeDone === true,
    grouping: GROUPINGS.some((g) => g.id === r.grouping) ? (r.grouping as MyTasksView['grouping']) : DEFAULT_VIEW.grouping,
    sort: SORTS.some((s) => s.id === r.sort) ? (r.sort as MyTasksView['sort']) : DEFAULT_VIEW.sort,
  };
};

export const loadView = (userId: string | undefined): MyTasksView => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
};

const saveView = (userId: string | undefined, view: MyTasksView) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(view));
  } catch {
    /* storage unavailable — the view still works for this session */
  }
};

/**
 * One-off filters from the URL (palette "Ask Hearth", sidebar teams, People results):
 *   ?overdue=1 &tag=Design &team=<id> &project=<id> &assignee=<id|none> &status=BLOCKED
 *   &priority=URGENT &due=today &q=text
 * They layer on top of the saved view and are cleared with "Clear".
 */
export interface UrlFilters {
  overdue: boolean;
  dueToday: boolean;
  tag: string | null;
  teamId: string | null;
  projectId: string | null;
  assigneeId: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  q: string | null;
}

export const URL_FILTER_KEYS = ['overdue', 'due', 'tag', 'team', 'project', 'assignee', 'status', 'priority', 'q'] as const;

export const readUrlFilters = (params: URLSearchParams): UrlFilters => {
  const status = params.get('status');
  const priority = params.get('priority');
  return {
    overdue: params.get('overdue') === '1' || params.get('overdue') === 'true',
    dueToday: params.get('due') === 'today',
    tag: params.get('tag'),
    teamId: params.get('team'),
    projectId: params.get('project'),
    assigneeId: params.get('assignee'),
    status: status && isTaskStatus(status) ? status : null,
    priority: priority && isPriority(priority) ? priority : null,
    q: params.get('q'),
  };
};

export const hasUrlFilters = (f: UrlFilters) =>
  f.overdue || f.dueToday || !!f.tag || !!f.teamId || !!f.projectId || !!f.assigneeId || !!f.status || !!f.priority || !!f.q;

/** Saved view + URL filters → the domain's serializable TaskFilter (team is resolved by the caller). */
export const toTaskFilter = (view: MyTasksView, url: UrlFilters, teamMemberIds: string[] | null): TaskFilter => {
  const statuses = url.status ? [url.status] : view.statuses;
  const assigneeIds: (string | null)[] | undefined = url.assigneeId
    ? [url.assigneeId === 'none' ? null : url.assigneeId]
    : teamMemberIds ?? undefined;
  return {
    statuses: statuses.length ? statuses : undefined,
    priorities: url.priority ? [url.priority] : view.priorities.length ? view.priorities : undefined,
    projectIds: url.projectId ? [url.projectId] : view.projectIds.length ? view.projectIds : undefined,
    tags: url.tag ? [url.tag] : undefined,
    assigneeIds,
    overdue: view.overdueOnly || url.overdue || undefined,
    dueToday: url.dueToday || undefined,
    includeDone: view.includeDone || undefined,
    text: url.q ?? undefined,
  };
};

/** Saved view state persisted per user, plus URL filters. */
export function useMyTasksView() {
  const userId = useAuthStore((s) => s.me?.user.id);
  const [view, setViewState] = useState<MyTasksView>(() => loadView(userId));
  const [params, setParams] = useSearchParams();

  useEffect(() => setViewState(loadView(userId)), [userId]);

  const setView = useCallback(
    (patch: Partial<MyTasksView>) =>
      setViewState((v) => {
        const next = { ...v, ...patch };
        saveView(userId, next);
        return next;
      }),
    [userId],
  );

  const url = useMemo(() => readUrlFilters(params), [params]);
  const clearUrlFilters = useCallback(
    () =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        URL_FILTER_KEYS.forEach((k) => next.delete(k));
        return next;
      }),
    [setParams],
  );
  const resetView = useCallback(() => setView({ statuses: [], priorities: [], projectIds: [], overdueOnly: false, includeDone: false }), [setView]);

  const activeFilterCount =
    view.statuses.length + view.priorities.length + view.projectIds.length + (view.overdueOnly ? 1 : 0) + (view.includeDone ? 1 : 0);

  return { view, setView, resetView, url, clearUrlFilters, activeFilterCount };
}
