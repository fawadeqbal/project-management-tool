import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskDetailDto, TaskDto } from '@hearth/contracts';
import { api, type TaskListQuery } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';

/** A task list (scope "mine" by default). Arrays in the query are sent as CSV. */
export function useTasks(query: TaskListQuery = { scope: 'mine' }, opts: { enabled?: boolean } = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery<TaskDto[]>({
    queryKey: queryKeys.tasks.list(query),
    queryFn: () => api.tasks.list(query),
    enabled: !!token && (opts.enabled ?? true),
  });
}

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}-\d+$/i;
export const isTaskKey = (v: string): boolean => KEY_PATTERN.test(v.trim());

/**
 * One task's detail by id or key ("HRT-142"). Keys and ids share the detail payload: a key fetch
 * also seeds ['task', id] so mutations by id update the panel immediately.
 */
export function useTask(idOrKey: string | null | undefined) {
  const client = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const byKey = !!idOrKey && isTaskKey(idOrKey);
  return useQuery<TaskDetailDto>({
    queryKey: idOrKey ? (byKey ? queryKeys.taskByKey(idOrKey) : queryKeys.task(idOrKey)) : ['task', 'none'],
    queryFn: async () => {
      const detail = byKey ? await api.tasks.getByKey(idOrKey!.toUpperCase()) : await api.tasks.get(idOrKey!);
      if (byKey) client.setQueryData(queryKeys.task(detail.id), detail);
      return detail;
    },
    enabled: !!token && !!idOrKey,
    staleTime: 15_000,
  });
}
