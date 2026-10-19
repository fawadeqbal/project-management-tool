import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WORKLOAD_ROUTES,
  type CreateTimeOffInput,
  type TimeOffDto,
  type WorkloadDto,
  type WorkloadQuery,
} from '@hearth/contracts';
import { ApiError, http } from '@/shared/api/http';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { toast } from '@/shared/toast/toast-store';
import { handlePlanLimit, taskStub } from '@/features/sprints';
import { firstName, reassignInWorkload } from './lib/workload-format';

export type WorkloadParams = Partial<WorkloadQuery>;

export const workloadApi = {
  get: (q: WorkloadParams) => http.get<WorkloadDto>(WORKLOAD_ROUTES.workload, q),
  timeOff: () => http.get<TimeOffDto[]>(WORKLOAD_ROUTES.timeOff),
  addTimeOff: (input: CreateTimeOffInput) => http.post<TimeOffDto>(WORKLOAD_ROUTES.timeOff, input),
  removeTimeOff: (id: string) => http.delete(WORKLOAD_ROUTES.timeOffById(id)),
};

export const workloadKeys = {
  all: ['workload'] as const,
  view: (q: WorkloadParams) => ['workload', 'view', q] as const,
  timeOff: ['workload', 'time-off'] as const,
};

export function useWorkload(q: WorkloadParams) {
  return useQuery({
    queryKey: workloadKeys.view(q),
    queryFn: () => workloadApi.get(q),
    placeholderData: (prev) => prev,
  });
}

export function useTimeOff(enabled = true) {
  return useQuery({ queryKey: workloadKeys.timeOff, queryFn: () => workloadApi.timeOff(), enabled });
}

const report = (err: unknown) => {
  if (!handlePlanLimit(err)) toast.error(ApiError.from(err).message);
};

/** Time off writes; deleting offers Undo (re-creates the same entry). */
export function useTimeOffMutations() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: workloadKeys.all });
  const add = useMutation({ mutationFn: workloadApi.addTimeOff, onError: report, onSettled: refresh });
  const remove = useMutation({
    mutationFn: (t: TimeOffDto) => workloadApi.removeTimeOff(t.id),
    onError: report,
    onSettled: refresh,
  });
  return useMemo(
    () => ({
      add: (input: CreateTimeOffInput) => add.mutateAsync(input),
      remove: (t: TimeOffDto) =>
        remove
          .mutateAsync(t)
          .then(() =>
            toast.show({
              message: `Removed ${firstName(t.user.name)}’s time off`,
              action: 'Undo',
              onAction: () =>
                void add
                  .mutateAsync({
                    userId: t.user.id,
                    startDate: t.startDate,
                    endDate: t.endDate,
                    reason: t.reason,
                  })
                  .catch(() => undefined),
            }),
          )
          .catch(() => undefined),
      isAdding: add.isPending,
    }),
    [add, remove],
  );
}

/**
 * Reassigns a task from the workload grid: optimistic in the workload cache, written through the
 * Tasks context (PATCH /tasks/:id via useTaskMutations), with an Undo toast.
 */
export function useReassign() {
  const client = useQueryClient();
  const tasks = useTaskMutations();
  return useMemo(() => {
    const patchCache = (taskId: string, toUserId: string) => {
      for (const [key, data] of client.getQueriesData<WorkloadDto>({ queryKey: workloadKeys.all })) {
        if (data && 'people' in data) client.setQueryData(key, reassignInWorkload(data, taskId, toUserId));
      }
    };
    const write = async (w: WorkloadDto, taskId: string, toUserId: string) => {
      const t = w.tasks[taskId];
      if (!t) return;
      patchCache(taskId, toUserId);
      await tasks.update(
        taskStub({ id: t.id, key: t.key, title: t.title, status: t.status, assigneeId: t.assigneeId }),
        { assigneeId: toUserId },
      );
      void client.invalidateQueries({ queryKey: workloadKeys.all });
    };
    return (w: WorkloadDto, taskId: string, toUserId: string) => {
      const t = w.tasks[taskId];
      const from = t?.assigneeId ?? null;
      const to = w.people.find((p) => p.user.id === toUserId)?.user;
      if (!t || !to || from === toUserId) return;
      void write(w, taskId, toUserId);
      toast.show({
        message: `${t.key} reassigned to ${firstName(to.name)}`,
        action: from ? 'Undo' : undefined,
        onAction: from
          ? () => {
              const current =
                client
                  .getQueriesData<WorkloadDto>({ queryKey: workloadKeys.all })
                  .find(([, d]) => d && d.tasks[taskId])?.[1] ?? w;
              void write(current, taskId, from);
            }
          : undefined,
      });
    };
  }, [client, tasks]);
}
