import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TIMELINE_ROUTES,
  type RescheduleResultDto,
  type RescheduleTaskInput,
  type ScheduleItemInput,
  type TimelineDto,
  type TimelineRowDto,
} from '@hearth/contracts';
import { http } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { useRealtimeEvent } from '@/shared/realtime';
import { addDays, parseDateOnly, toDateOnly } from '@hearth/domain';

export type RescheduleRequest = Omit<RescheduleTaskInput, 'shiftDependents'> & { shiftDependents?: boolean };

export const timelineApi = {
  get: (projectId: string, range: { from?: string; to?: string } = {}) => http.get<TimelineDto>(TIMELINE_ROUTES.byProject(projectId), range),
  reschedule: (taskId: string, input: RescheduleRequest) => http.post<RescheduleResultDto>(TIMELINE_ROUTES.reschedule(taskId), { shiftDependents: true, ...input }),
  applySchedule: (items: ScheduleItemInput[]) => http.post<{ updated: ScheduleItemInput[] }>(TIMELINE_ROUTES.schedule, { items }),
};

export const timelineKeys = {
  all: ['timeline'] as const,
  project: (projectId: string) => ['timeline', projectId] as const,
};

/** The project's Gantt read model; refetches when any task or milestone in it changes. */
export function useTimeline(projectId: string) {
  const client = useQueryClient();
  useRealtimeEvent('task.', (e) => {
    if (e.payload.projectId === projectId || e.payload.projectId === undefined) void client.invalidateQueries({ queryKey: timelineKeys.project(projectId) });
  });
  useRealtimeEvent('milestone.', () => void client.invalidateQueries({ queryKey: timelineKeys.project(projectId) }));
  return useQuery({
    queryKey: timelineKeys.project(projectId),
    queryFn: () => timelineApi.get(projectId),
    enabled: !!useAuthStore((s) => s.token) && !!projectId,
    staleTime: 15_000,
  });
}

/** Shift a row's dates by whole days (pure, for the optimistic patch). */
const shiftRow = (row: TimelineRowDto, start: string, end: string): TimelineRowDto =>
  row.kind === 'task' ? { ...row, startDate: start, dueDate: end } : row.kind === 'milestone' ? { ...row, date: end } : row;

export const shiftIso = (d: string, days: number) => toDateOnly(addDays(parseDateOnly(d), days));

export interface RescheduleVars {
  taskId: string;
  input: RescheduleRequest;
}

/** Optimistically moves the bar; the server's answer (with dependents shifted) replaces it. */
export function useReschedule(projectId: string) {
  return useOptimisticMutation<RescheduleResultDto, RescheduleVars>({
    mutationFn: ({ taskId, input }) => timelineApi.reschedule(taskId, input),
    affects: () => [timelineKeys.project(projectId), queryKeys.tasks.all],
    apply: (client, { taskId, input }) =>
      client.setQueryData<TimelineDto>(timelineKeys.project(projectId), (t) =>
        t ? { ...t, rows: t.rows.map((r) => (r.id === taskId ? shiftRow(r, input.startDate, input.dueDate) : r)) } : t,
      ),
  });
}

/** Puts explicit dates back (Undo of a reschedule, restoring every shifted dependent too). */
export function useApplySchedule(projectId: string) {
  return useOptimisticMutation<{ updated: ScheduleItemInput[] }, ScheduleItemInput[]>({
    mutationFn: (items) => timelineApi.applySchedule(items),
    affects: () => [timelineKeys.project(projectId), queryKeys.tasks.all],
    apply: (client, items) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      client.setQueryData<TimelineDto>(timelineKeys.project(projectId), (t) =>
        t
          ? {
              ...t,
              rows: t.rows.map((r) => {
                const i = byId.get(r.id);
                return i ? shiftRow(r, i.startDate ?? i.dueDate!, i.dueDate ?? i.startDate!) : r;
              }),
            }
          : t,
      );
    },
  });
}
