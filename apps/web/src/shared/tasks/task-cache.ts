import type { QueryClient } from '@tanstack/react-query';
import type {
  MemberDto,
  TagDto,
  TaskDetailDto,
  TaskDto,
  UpdateTaskInput,
  UserRefDto,
} from '@hearth/contracts';
import { queryKeys } from '@/shared/api/query-keys';

/** Anything in the ['task', …] detail caches. */
type DetailLike = TaskDetailDto | undefined;

const toUserRef = (m: MemberDto): UserRefDto => ({
  id: m.id,
  name: m.name,
  initials: m.initials,
  avatarColor: m.avatarColor,
});

/**
 * Applies an UpdateTaskInput to a TaskDto the way the server would, resolving references
 * (assignee, tags) from what's already cached so the optimistic row looks final.
 */
export const applyTaskPatch = <T extends TaskDto>(
  task: T,
  patch: UpdateTaskInput,
  client: QueryClient,
  now = new Date(),
): T => {
  const next: T = { ...task };
  const { tagIds, assigneeId, ...rest } = patch;
  Object.assign(next, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
  if (assigneeId !== undefined) {
    next.assigneeId = assigneeId;
    const member = assigneeId
      ? client.getQueryData<MemberDto[]>(queryKeys.members)?.find((m) => m.id === assigneeId)
      : undefined;
    next.assignee = assigneeId ? (member ? toUserRef(member) : task.assignee) : null;
  }
  if (tagIds) {
    const known = client.getQueryData<TagDto[]>(queryKeys.tags) ?? [];
    const pool = new Map([...task.tags, ...known].map((t) => [t.id, t]));
    next.tags = tagIds.map((id) => pool.get(id)).filter((t): t is TagDto => !!t);
  }
  if (patch.status !== undefined && patch.status !== task.status) {
    next.completedAt = patch.status === 'DONE' ? now.toISOString() : null;
  }
  next.updatedAt = now.toISOString();
  return next;
};

/** Patch one task in every list and detail cache (including as a subtask of its parent). */
export const patchTaskInCaches = (
  client: QueryClient,
  id: string,
  update: <T extends TaskDto>(t: T) => T,
): void => {
  client.setQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all }, (list) =>
    Array.isArray(list) ? list.map((t) => (t.id === id ? update(t) : t)) : list,
  );
  client.setQueriesData<DetailLike>({ queryKey: queryKeys.taskRoot }, (detail) => {
    if (!detail || typeof detail !== 'object' || !('id' in detail)) return detail;
    let changed = detail;
    if (detail.id === id) changed = update(detail);
    if (Array.isArray(detail.subtasks) && detail.subtasks.some((s) => s.id === id)) {
      const subtasks = detail.subtasks.map((s) => (s.id === id ? update(s) : s));
      changed = {
        ...changed,
        subtasks,
        subtaskDoneCount: subtasks.filter((s) => s.status === 'DONE').length,
      };
    }
    return changed;
  });
};

export const removeTaskFromCaches = (client: QueryClient, id: string): void => {
  client.setQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all }, (list) =>
    Array.isArray(list) ? list.filter((t) => t.id !== id) : list,
  );
  client.setQueriesData<DetailLike>({ queryKey: queryKeys.taskRoot }, (detail) => {
    if (!detail || typeof detail !== 'object' || !Array.isArray(detail.subtasks)) return detail;
    if (!detail.subtasks.some((s) => s.id === id)) return detail;
    const subtasks = detail.subtasks.filter((s) => s.id !== id);
    return {
      ...detail,
      subtasks,
      subtaskCount: subtasks.length,
      subtaskDoneCount: subtasks.filter((s) => s.status === 'DONE').length,
    };
  });
};

/** Inserts a task into lists that would contain it (by default: "mine" lists). */
export const insertTaskIntoLists = (
  client: QueryClient,
  task: TaskDto,
  matches: (query: Record<string, unknown>) => boolean = (q) => (q.scope ?? 'mine') === 'mine',
): void => {
  for (const [key, list] of client.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.lists() })) {
    const query = (key[2] ?? {}) as Record<string, unknown>;
    if (!Array.isArray(list) || !matches(query)) continue;
    client.setQueryData<TaskDto[]>(key, [...list.filter((t) => t.id !== task.id), task]);
  }
};

/** Swap a temporary (optimistic) id for the server's task everywhere. */
export const replaceTaskInLists = (client: QueryClient, tempId: string, task: TaskDto): void => {
  client.setQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all }, (list) =>
    Array.isArray(list) ? list.map((t) => (t.id === tempId ? task : t)) : list,
  );
};

/** Best-effort lookup of a task already in some cache (palette, commands, panels). */
export const findCachedTask = (
  client: QueryClient,
  predicate: (t: TaskDto) => boolean,
): TaskDto | undefined => {
  for (const [, data] of client.getQueriesData<TaskDto[] | TaskDetailDto>({
    queryKey: queryKeys.tasks.all,
  })) {
    if (Array.isArray(data)) {
      const hit = data.find(predicate);
      if (hit) return hit;
    }
  }
  for (const [, data] of client.getQueriesData<TaskDetailDto>({ queryKey: queryKeys.taskRoot })) {
    if (data && typeof data === 'object' && 'id' in data) {
      if (predicate(data)) return data;
      const sub = data.subtasks?.find(predicate);
      if (sub) return sub;
    }
  }
  return undefined;
};

/** Every distinct task currently cached (for local palette search). */
export const allCachedTasks = (client: QueryClient): TaskDto[] => {
  const byId = new Map<string, TaskDto>();
  for (const [, data] of client.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all })) {
    if (Array.isArray(data)) data.forEach((t) => byId.set(t.id, t));
  }
  for (const [, data] of client.getQueriesData<TaskDetailDto>({ queryKey: queryKeys.taskRoot })) {
    if (data && typeof data === 'object' && 'id' in data) {
      if (!byId.has(data.id)) byId.set(data.id, data);
      data.subtasks?.forEach((s) => byId.has(s.id) || byId.set(s.id, s));
    }
  }
  return [...byId.values()];
};

/** Update every cached detail payload for a task (by-id and by-key entries). */
export const patchTaskDetail = (
  client: QueryClient,
  id: string,
  update: (d: TaskDetailDto) => TaskDetailDto,
): void => {
  client.setQueriesData<DetailLike>({ queryKey: queryKeys.taskRoot }, (detail) =>
    detail &&
    typeof detail === 'object' &&
    'id' in detail &&
    detail.id === id &&
    Array.isArray(detail.comments)
      ? update(detail)
      : detail,
  );
};
