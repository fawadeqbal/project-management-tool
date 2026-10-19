import type { TaskDto } from '@hearth/contracts';

/**
 * Server-side ⌘K search across tasks, projects and people.
 * TODO(search stream): call the search context (`features/search` / SEARCH_ROUTES in
 * @hearth/contracts search.ts) with a debounced useQuery once the endpoint exists. The palette
 * already merges these results with local matches, de-duplicated by id.
 */
export function useServerSearch(_query: string): { tasks: TaskDto[]; isFetching: boolean } {
  return { tasks: [], isFetching: false };
}
