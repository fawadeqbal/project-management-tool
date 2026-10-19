import { useMemo } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { CreateTaskInput, TaskDto, TaskStatusDto, UpdateTaskInput } from '@hearth/contracts';
import { STATUS_META, parseQuickAdd, toDateOnly } from '@hearth/domain';
import { api, type MoveTaskRequest, type QuickAddRequest } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { toast } from '@/shared/toast/toast-store';
import { today } from './dates';
import {
  applyTaskPatch,
  insertTaskIntoLists,
  patchTaskInCaches,
  removeTaskFromCaches,
  replaceTaskInLists,
} from './task-cache';

/** Every task write uses this key, so "Saving…/Saved" can watch them all. */
export const TASK_SAVE_KEY = ['task-save'] as const;

const affectsTask = (_id: string): QueryKey[] => [queryKeys.tasks.all, queryKeys.taskRoot];

interface UpdateVars {
  id: string;
  patch: UpdateTaskInput;
}

/** Snapshot of the fields a patch will overwrite, so Undo can put them back. */
const inverseOf = (task: TaskDto, patch: UpdateTaskInput): UpdateTaskInput => {
  const inverse: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof UpdateTaskInput)[]) {
    if (key === 'tagIds') inverse.tagIds = task.tags.map((t) => t.id);
    else inverse[key] = (task as unknown as Record<string, unknown>)[key];
  }
  return inverse as UpdateTaskInput;
};

export interface UpdateOptions {
  /** Show an Undo toast with this message (e.g. "Moved to In review"). */
  undoMessage?: string;
}

/**
 * Every task write, optimistic across all task lists and detail caches, with Undo toasts for
 * reversible changes (ADR 0004). Delete is irreversible — confirm before calling `remove`.
 */
export function useTaskMutations() {
  const client = useQueryClient();
  const me = useAuthStore((s) => s.me);

  const updateMutation = useOptimisticMutation<TaskDto, UpdateVars>({
    mutationKey: TASK_SAVE_KEY,
    mutationFn: ({ id, patch }) => api.tasks.update(id, patch),
    affects: ({ id }) => affectsTask(id),
    apply: (c, { id, patch }) => patchTaskInCaches(c, id, (t) => applyTaskPatch(t, patch, c)),
    onSuccess: (task, { id }) => patchTaskInCaches(client, id, (t) => ({ ...t, ...task })),
  });

  const moveMutation = useOptimisticMutation<TaskDto, { id: string; input: MoveTaskRequest }>({
    mutationKey: TASK_SAVE_KEY,
    mutationFn: ({ id, input }) => api.tasks.move(id, input),
    affects: ({ id }) => affectsTask(id),
    apply: (c, { id, input }) => {
      if (input.status) patchTaskInCaches(c, id, (t) => applyTaskPatch(t, { status: input.status }, c));
    },
  });

  const removeMutation = useOptimisticMutation<void, TaskDto>({
    mutationFn: (task) => api.tasks.remove(task.id),
    affects: (task) => [...affectsTask(task.id), queryKeys.shell],
    apply: (c, task) => removeTaskFromCaches(c, task.id),
    onSuccess: (_d, task) => {
      client.removeQueries({ queryKey: queryKeys.task(task.id), exact: true });
      toast.show({ message: `${task.key} deleted`, icon: 'trash', tone: 'info' });
    },
  });

  const createMutation = useOptimisticMutation<TaskDto, { input: CreateTaskInput; tempId: string }>({
    mutationFn: ({ input }) => api.tasks.create(input),
    affects: () => [queryKeys.tasks.all, queryKeys.shell],
    apply: (c, { input, tempId }) => {
      if (input.parentId) return;
      if (input.assigneeId && me && input.assigneeId !== me.user.id) return;
      insertTaskIntoLists(c, draftTask(tempId, input, me?.user.id ?? null, me?.workspace.keyPrefix ?? 'NEW'));
    },
    onSuccess: (task, { tempId }) => replaceTaskInLists(client, tempId, task),
    errorMessage: (e) => e.message,
  });

  const quickAddMutation = useOptimisticMutation<TaskDto, { input: QuickAddRequest; tempId: string }>({
    mutationFn: ({ input }) => api.tasks.quickAdd(input),
    affects: () => [queryKeys.tasks.all, queryKeys.shell],
    apply: (c, { input, tempId }) => {
      const parsed = parseQuickAdd(input.text, today());
      // Someone else @mentioned → it won't land in My tasks; don't flash it there.
      if (parsed.assigneeHandle) return;
      insertTaskIntoLists(
        c,
        draftTask(
          tempId,
          {
            title: parsed.title || input.text,
            priority: parsed.priority ?? undefined,
            dueDate: parsed.dueDate ? toDateOnly(parsed.dueDate) : null,
            projectId: input.projectId ?? null,
          },
          me?.user.id ?? null,
          me?.workspace.keyPrefix ?? 'NEW',
        ),
      );
    },
    onSuccess: (task, { tempId }) => replaceTaskInLists(client, tempId, task),
  });

  return useMemo(() => {
    const findTask = (id: string): TaskDto | undefined => {
      for (const [, data] of client.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all })) {
        const hit = Array.isArray(data) ? data.find((t) => t.id === id) : undefined;
        if (hit) return hit;
      }
      const detail = client.getQueryData<TaskDto>(queryKeys.task(id));
      return detail;
    };

    const update = (task: TaskDto | string, patch: UpdateTaskInput, opts: UpdateOptions = {}) => {
      const current = typeof task === 'string' ? findTask(task) : task;
      const id = typeof task === 'string' ? task : task.id;
      const inverse = current ? inverseOf(current, patch) : null;
      const promise = updateMutation.mutateAsync({ id, patch });
      if (opts.undoMessage && inverse) {
        toast.show({
          message: opts.undoMessage,
          action: 'Undo',
          onAction: () => void updateMutation.mutateAsync({ id, patch: inverse }).catch(() => undefined),
        });
      }
      return promise.catch(() => undefined);
    };

    const setStatus = (task: TaskDto, status: TaskStatusDto) =>
      update(
        task,
        { status },
        {
          undoMessage:
            status === 'DONE'
              ? `${task.key} marked as done`
              : `${task.key} moved to ${STATUS_META[status].label}`,
        },
      );

    /** Space / checkbox: done ↔ reopen (back to To do), with Undo restoring the exact previous status. */
    const toggleDone = (task: TaskDto) => {
      if (task.status === 'DONE')
        return update(task, { status: 'TODO' }, { undoMessage: `${task.key} reopened` });
      return update(task, { status: 'DONE' }, { undoMessage: `${task.key} marked as done` });
    };

    const move = (task: TaskDto, input: MoveTaskRequest, undo = true) => {
      const previous = task.status;
      const promise = moveMutation.mutateAsync({ id: task.id, input }).catch(() => undefined);
      if (undo && input.status && input.status !== previous) {
        toast.show({
          message: `${task.key} moved to ${STATUS_META[input.status].label}`,
          action: 'Undo',
          onAction: () =>
            void moveMutation
              .mutateAsync({ id: task.id, input: { status: previous, ordering: input.ordering } })
              .catch(() => undefined),
        });
      }
      return promise;
    };

    const remove = (task: TaskDto) => removeMutation.mutateAsync(task).catch(() => undefined);

    const create = async (input: CreateTaskInput): Promise<TaskDto | undefined> => {
      try {
        return await createMutation.mutateAsync({ input, tempId: tempTaskId() });
      } catch {
        return undefined;
      }
    };

    const quickAdd = async (input: QuickAddRequest): Promise<TaskDto | undefined> => {
      try {
        return await quickAddMutation.mutateAsync({ input, tempId: tempTaskId() });
      } catch {
        return undefined;
      }
    };

    return {
      update,
      setStatus,
      toggleDone,
      move,
      remove,
      create,
      quickAdd,
      isSaving: updateMutation.isPending,
    };
  }, [client, updateMutation, moveMutation, removeMutation, createMutation, quickAddMutation]);
}

let tempSeq = 0;
const tempTaskId = () => `optimistic-${Date.now()}-${++tempSeq}`;
export const isOptimisticId = (id: string) => id.startsWith('optimistic-');

/** A placeholder row shown while the server creates the real task. */
const draftTask = (
  id: string,
  input: Partial<CreateTaskInput> & { title: string },
  assigneeId: string | null,
  prefix: string,
): TaskDto => {
  const now = new Date().toISOString();
  return {
    id,
    key: `${prefix}-…`,
    number: 0,
    title: input.title,
    status: input.status ?? 'TODO',
    priority: input.priority ?? 'NONE',
    assigneeId: input.assigneeId ?? assigneeId,
    assignee: null,
    projectId: input.projectId ?? null,
    project: null,
    sectionId: input.sectionId ?? null,
    parentId: input.parentId ?? null,
    sprintId: input.sprintId ?? null,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints ?? null,
    estimateHours: input.estimateHours ?? null,
    progress: 0,
    epic: null,
    tags: [],
    commentCount: 0,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    blockedBy: [],
    boardPosition: Number.MAX_SAFE_INTEGER,
    listPosition: Number.MAX_SAFE_INTEGER,
    backlogRank: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};
