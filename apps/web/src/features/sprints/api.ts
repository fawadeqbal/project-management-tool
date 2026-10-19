import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  SPRINT_ROUTES,
  type CompleteSprintInput,
  type CreateSprintInput,
  type RankBacklogInput,
  type RetrospectiveDto,
  type SprintDetailDto,
  type SprintSummaryDto,
  type SprintTaskDto,
  type UpdateSprintInput,
} from '@hearth/contracts';
import { ApiError, http } from '@/shared/api/http';
import { toast } from '@/shared/toast/toast-store';
import { handlePlanLimit } from './plan-gate';
import { applyRank } from './lib/backlog-order';

export const sprintsApi = {
  list: (projectId: string) => http.get<SprintSummaryDto[]>(SPRINT_ROUTES.list(projectId)),
  detail: (id: string) => http.get<SprintDetailDto>(SPRINT_ROUTES.byId(id)),
  backlog: (projectId: string) => http.get<SprintTaskDto[]>(SPRINT_ROUTES.backlog(projectId)),
  plan: (projectId: string, input: CreateSprintInput) => http.post<SprintSummaryDto>(SPRINT_ROUTES.list(projectId), input),
  update: (id: string, input: UpdateSprintInput) => http.patch<SprintSummaryDto>(SPRINT_ROUTES.byId(id), input),
  start: (id: string) => http.post<SprintSummaryDto>(SPRINT_ROUTES.start(id)),
  complete: (id: string, input: CompleteSprintInput) => http.post<RetrospectiveDto>(SPRINT_ROUTES.complete(id), input),
  addTask: (id: string, taskId: string) => http.post<SprintSummaryDto>(SPRINT_ROUTES.tasks(id), { taskId }),
  removeTask: (id: string, taskId: string) => http.delete<SprintSummaryDto>(SPRINT_ROUTES.task(id, taskId)),
  rank: (projectId: string, input: RankBacklogInput) => http.post<{ taskId: string; backlogRank: number }>(SPRINT_ROUTES.rank(projectId), input),
};

export const sprintKeys = {
  all: ['sprints'] as const,
  list: (projectId: string) => ['sprints', 'list', projectId] as const,
  detail: (id: string) => ['sprints', 'detail', id] as const,
  backlog: (projectId: string) => ['sprints', 'backlog', projectId] as const,
};

export function useSprints(projectId: string | undefined) {
  return useQuery({ queryKey: sprintKeys.list(projectId ?? ''), queryFn: () => sprintsApi.list(projectId!), enabled: !!projectId });
}

export function useSprintDetail(id: string | null | undefined) {
  return useQuery({ queryKey: sprintKeys.detail(id ?? ''), queryFn: () => sprintsApi.detail(id!), enabled: !!id });
}

export function useBacklog(projectId: string | undefined) {
  return useQuery({ queryKey: sprintKeys.backlog(projectId ?? ''), queryFn: () => sprintsApi.backlog(projectId!), enabled: !!projectId });
}

/** 402 → upgrade dialog; anything else → the API's human message in a toast. */
export const reportPlanningError = (err: unknown) => {
  if (handlePlanLimit(err)) return;
  toast.error(ApiError.from(err).message);
};

/**
 * Optimistic planning write: snapshot the affected sprint caches, apply, roll back on failure
 * (with the upgrade dialog for 402), and always refresh the sprint queries afterwards.
 */
function usePlanningMutation<TData, TVars>(config: {
  mutationFn: (vars: TVars) => Promise<TData>;
  affects: QueryKey[];
  apply?: (vars: TVars) => void;
  onSuccess?: (data: TData, vars: TVars) => void;
}) {
  const client = useQueryClient();
  return useMutation<TData, unknown, TVars, { snapshot: [QueryKey, unknown][] }>({
    mutationFn: config.mutationFn,
    onMutate: async (vars) => {
      await Promise.all(config.affects.map((queryKey) => client.cancelQueries({ queryKey })));
      const snapshot = config.affects.flatMap((queryKey) => client.getQueriesData({ queryKey }));
      config.apply?.(vars);
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
      reportPlanningError(err);
    },
    onSuccess: (data, vars) => config.onSuccess?.(data, vars),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: sprintKeys.all });
      void client.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Every sprint write for a project, with Undo where it's reversible. */
export function useSprintMutations(projectId: string) {
  const client = useQueryClient();

  const start = usePlanningMutation({
    mutationFn: (id: string) => sprintsApi.start(id),
    affects: [sprintKeys.all],
    onSuccess: (s: SprintSummaryDto) => toast.show({ message: `${s.name} started · ${s.committedPoints} points committed`, icon: 'zap' }),
  });

  const complete = usePlanningMutation({
    mutationFn: ({ id, moveUnfinishedTo }: { id: string; moveUnfinishedTo: 'backlog' | 'next' }) => sprintsApi.complete(id, { moveUnfinishedTo }),
    affects: [sprintKeys.all],
  });

  const plan = usePlanningMutation({
    mutationFn: (input: CreateSprintInput) => sprintsApi.plan(projectId, input),
    affects: [sprintKeys.list(projectId)],
    onSuccess: (s: SprintSummaryDto) => toast.show({ message: `${s.name} planned`, icon: 'calendar' }),
  });

  const update = usePlanningMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSprintInput }) => sprintsApi.update(id, input),
    affects: [sprintKeys.all],
  });

  const add = usePlanningMutation({
    mutationFn: ({ sprintId, task }: { sprintId: string; task: SprintTaskDto }) => sprintsApi.addTask(sprintId, task.id),
    affects: [sprintKeys.backlog(projectId), sprintKeys.all],
    apply: ({ sprintId, task }) => {
      client.setQueryData<SprintTaskDto[]>(sprintKeys.backlog(projectId), (old) => old?.filter((t) => t.id !== task.id));
      client.setQueryData<SprintDetailDto>(sprintKeys.detail(sprintId), (old) => (old ? { ...old, tasks: [...old.tasks, { ...task, sprintId }] } : old));
    },
  });

  const remove = usePlanningMutation({
    mutationFn: ({ sprintId, task }: { sprintId: string; task: SprintTaskDto }) => sprintsApi.removeTask(sprintId, task.id),
    affects: [sprintKeys.backlog(projectId), sprintKeys.all],
    apply: ({ sprintId, task }) => {
      client.setQueryData<SprintDetailDto>(sprintKeys.detail(sprintId), (old) => (old ? { ...old, tasks: old.tasks.filter((t) => t.id !== task.id) } : old));
      client.setQueryData<SprintTaskDto[]>(sprintKeys.backlog(projectId), (old) => (old ? [{ ...task, sprintId: null }, ...old] : old));
    },
  });

  const rank = usePlanningMutation({
    mutationFn: (input: RankBacklogInput) => sprintsApi.rank(projectId, input),
    affects: [sprintKeys.backlog(projectId)],
    apply: (input) => client.setQueryData<SprintTaskDto[]>(sprintKeys.backlog(projectId), (old) => (old ? applyRank(old, input) : old)),
  });

  return useMemo(
    () => ({
      start: (id: string) => start.mutateAsync(id).catch(() => undefined),
      complete: (id: string, moveUnfinishedTo: 'backlog' | 'next') => complete.mutateAsync({ id, moveUnfinishedTo }).catch(() => undefined),
      plan: (input: CreateSprintInput = {}) => plan.mutateAsync(input).catch(() => undefined),
      update: (id: string, input: UpdateSprintInput) => update.mutateAsync({ id, input }).catch(() => undefined),
      addToSprint: (sprintId: string, sprintName: string, task: SprintTaskDto) => {
        void add
          .mutateAsync({ sprintId, task })
          .then(() =>
            toast.show({
              message: `${task.key} added to ${sprintName}`,
              action: 'Undo',
              onAction: () => void remove.mutateAsync({ sprintId, task }).catch(() => undefined),
            }),
          )
          .catch(() => undefined);
      },
      moveToBacklog: (sprintId: string, sprintName: string, task: SprintTaskDto) => {
        void remove
          .mutateAsync({ sprintId, task })
          .then(() =>
            toast.show({
              message: `${task.key} moved from ${sprintName} back to the backlog`,
              action: 'Undo',
              onAction: () => void add.mutateAsync({ sprintId, task }).catch(() => undefined),
            }),
          )
          .catch(() => undefined);
      },
      rank: (input: RankBacklogInput) => rank.mutateAsync(input).catch(() => undefined),
      isStarting: start.isPending,
      isCompleting: complete.isPending,
    }),
    [start, complete, plan, update, add, remove, rank],
  );
}
