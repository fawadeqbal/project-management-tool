import type { TaskListQuery } from './client';

/**
 * Hierarchical query keys. Invalidating a prefix invalidates everything under it:
 *   invalidateQueries({ queryKey: queryKeys.tasks.all })  → every task list
 * Features add their own keys with the same shape: ['projects', 'list'], ['inbox', ...].
 */
export const queryKeys = {
  me: ['me'] as const,
  shell: ['shell'] as const,
  members: ['members'] as const,
  teams: ['teams'] as const,
  tags: ['tags'] as const,
  inbox: ['inbox'] as const,
  tasks: {
    all: ['tasks'] as const,
    lists: () => ['tasks', 'list'] as const,
    list: (query: TaskListQuery) => ['tasks', 'list', query] as const,
  },
  /** A single task's detail, keyed by id. `byKey` is resolved to an id via the detail payload. */
  task: (id: string) => ['task', id] as const,
  taskByKey: (key: string) => ['task', 'key', key.toUpperCase()] as const,
  taskRoot: ['task'] as const,
};
