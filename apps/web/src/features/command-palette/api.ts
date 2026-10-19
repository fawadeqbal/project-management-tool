import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AI_ROUTES,
  SEARCH_ROUTES,
  type InterpretResultDto,
  type SearchPersonHitDto,
  type SearchProjectHitDto,
  type SearchResultDto,
  type SearchScopeDto,
  type SearchTaskHitDto,
  type TaskDto,
} from '@hearth/contracts';
import { http } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';
import type { PaletteScope } from '@/shared/layout/ui-store';

/** Wait this long after the last keystroke; local fuzzy results show instantly meanwhile. */
export const SEARCH_DEBOUNCE_MS = 120;
const MIN_CHARS = 2;

export const searchApi = {
  search: (q: string, scope: SearchScopeDto, limit = 8, signal?: AbortSignal) =>
    http.get<SearchResultDto>(SEARCH_ROUTES.search, { q, scope, limit }, { signal }),
  interpret: (query: string) => http.post<InterpretResultDto>(AI_ROUTES.interpret, { query }),
};

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, scope: SearchScopeDto) => ['search', scope, q] as const,
};

const toSearchScope = (scope: PaletteScope): SearchScopeDto | null => (scope === 'commands' ? null : scope);

/** A server hit in the TaskDto shape the palette ranks and renders (fields it doesn't show are neutral). */
export const hitToTask = (hit: SearchTaskHitDto): TaskDto => ({
  id: hit.id,
  key: hit.key,
  number: hit.number,
  title: hit.title,
  status: hit.status,
  priority: hit.priority,
  assigneeId: hit.assignee?.id ?? null,
  assignee: hit.assignee,
  projectId: hit.project?.id ?? null,
  project: hit.project,
  sectionId: null,
  parentId: hit.parentId,
  sprintId: null,
  startDate: null,
  dueDate: hit.dueDate,
  estimatePoints: null,
  estimateHours: null,
  progress: 0,
  epic: null,
  tags: hit.tags,
  commentCount: 0,
  subtaskCount: 0,
  subtaskDoneCount: 0,
  blockedBy: [],
  boardPosition: 0,
  listPosition: 0,
  backlogRank: null,
  completedAt: null,
  createdAt: hit.updatedAt,
  updatedAt: hit.updatedAt,
});

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export interface ServerSearch {
  /** Server task hits (as TaskDto) — the palette merges them with local matches by id. */
  tasks: TaskDto[];
  projects: SearchProjectHitDto[];
  people: SearchPersonHitDto[];
  isFetching: boolean;
  /** Server time for the last result, for "Matched in 12 ms". */
  tookMs: number | null;
}

const EMPTY: TaskDto[] = [];

/**
 * Server-side ⌘K search across tasks, projects and people (GET /search), debounced 120 ms so
 * typing stays local-fast; results stream in after the local matches. Previous results stay on
 * screen while the next query loads, so the list doesn't flicker.
 */
export function useServerSearch(query: string, scope: PaletteScope = 'all'): ServerSearch {
  const token = useAuthStore((s) => s.token);
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const searchScope = toSearchScope(scope);
  const enabled = !!token && !!searchScope && q.length >= MIN_CHARS;
  const result = useQuery({
    queryKey: searchKeys.query(q, searchScope ?? 'all'),
    queryFn: ({ signal }) => searchApi.search(q, searchScope ?? 'all', 8, signal),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const data = enabled ? result.data : undefined;
  const tasks = useMemo(() => (data ? data.tasks.map(hitToTask) : EMPTY), [data]);
  return {
    tasks,
    projects: data?.projects ?? [],
    people: data?.people ?? [],
    // "Searching" covers the debounce window too, so the palette can show it right away.
    isFetching: !!searchScope && query.trim().length >= MIN_CHARS && (q !== query.trim() || result.isFetching),
    tookMs: data?.tookMs ?? null,
  };
}

/**
 * "Ask Hearth AI": asks the server to interpret the query with the workspace vocabulary
 * (POST /ai/interpret) and returns where to go. Falls back to the local interpretation's link
 * when the server can't help, so Enter always does something.
 */
export async function askHearth(query: string, fallbackHref?: string): Promise<string> {
  try {
    const res = await searchApi.interpret(query);
    if (res.recognized) return res.href;
  } catch {
    /* fall through to the local interpretation */
  }
  return fallbackHref ?? `/my-tasks?q=${encodeURIComponent(query.trim())}`;
}
