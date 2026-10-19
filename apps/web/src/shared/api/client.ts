import {
  AUTH_ROUTES,
  TASK_ROUTES,
  WORKSPACE_ROUTES,
  type AuthResponseDto,
  type CommentDto,
  type CreateCommentInput,
  type CreateTagInput,
  type CreateTaskInput,
  type ListTasksQuery,
  type LoginInput,
  type MeDto,
  type MemberDto,
  type MoveTaskInput,
  type QuickAddTaskInput,
  type RegisterInput,
  type ShellDto,
  type TagDto,
  type TaskDetailDto,
  type TaskDto,
  type TeamDto,
  type UpdateProfileInput,
  type UpdateTaskInput,
} from '@hearth/contracts';
import { http, type QueryParams } from './http';

/** Request shapes as the caller writes them (server-side defaults are optional here). */
export type TaskListQuery = Partial<ListTasksQuery>;
export type QuickAddRequest = Omit<QuickAddTaskInput, 'assignToMe'> & { assignToMe?: boolean };
export type MoveTaskRequest = Omit<MoveTaskInput, 'ordering'> & { ordering?: MoveTaskInput['ordering'] };
export type CreateTagRequest = Omit<CreateTagInput, 'color'> & { color?: CreateTagInput['color'] };

/** Lists may come back bare or wrapped in a Page envelope; normalize to an array. */
const items = <T>(res: T[] | { items: T[] }): T[] => (Array.isArray(res) ? res : res.items);

/**
 * Facade over the HTTP API for the core contexts (identity, workspace, tasks). Components never
 * call fetch; hooks call `api.tasks.update(...)`. Other contexts live in `features/<f>/api.ts`
 * and use `http` from '@/shared/api/http' directly.
 */
export const api = {
  auth: {
    register: (input: RegisterInput) => http.post<AuthResponseDto>(AUTH_ROUTES.register, input),
    login: (input: LoginInput) => http.post<AuthResponseDto>(AUTH_ROUTES.login, input),
  },
  me: {
    get: () => http.get<MeDto>(AUTH_ROUTES.me),
    update: (input: UpdateProfileInput) => http.patch<MeDto>(AUTH_ROUTES.me, input),
  },
  workspace: {
    members: async () =>
      items(await http.get<MemberDto[] | { items: MemberDto[] }>(WORKSPACE_ROUTES.members)),
    teams: async () => items(await http.get<TeamDto[] | { items: TeamDto[] }>(WORKSPACE_ROUTES.teams)),
    tags: async () => items(await http.get<TagDto[] | { items: TagDto[] }>(WORKSPACE_ROUTES.tags)),
    createTag: (input: CreateTagRequest) => http.post<TagDto>(WORKSPACE_ROUTES.tags, input),
    shell: () => http.get<ShellDto>(WORKSPACE_ROUTES.shell),
  },
  tasks: {
    list: async (query: TaskListQuery = {}) =>
      items(await http.get<TaskDto[] | { items: TaskDto[] }>(TASK_ROUTES.list, query as QueryParams)),
    get: (id: string) => http.get<TaskDetailDto>(TASK_ROUTES.byId(id)),
    getByKey: (key: string) => http.get<TaskDetailDto>(TASK_ROUTES.byKey(key)),
    create: (input: CreateTaskInput) => http.post<TaskDto>(TASK_ROUTES.list, input),
    quickAdd: (input: QuickAddRequest) => http.post<TaskDto>(TASK_ROUTES.quickAdd, input),
    update: (id: string, input: UpdateTaskInput) => http.patch<TaskDto>(TASK_ROUTES.byId(id), input),
    move: (id: string, input: MoveTaskRequest) => http.post<TaskDto>(TASK_ROUTES.move(id), input),
    remove: (id: string) => http.delete(TASK_ROUTES.byId(id)),
    addComment: (id: string, input: CreateCommentInput) =>
      http.post<CommentDto>(TASK_ROUTES.comments(id), input),
    addDependency: (id: string, blockerId: string) =>
      http.post<unknown>(TASK_ROUTES.dependencies(id), { blockerId }),
    removeDependency: (id: string, blockerId: string) => http.delete(TASK_ROUTES.dependency(id, blockerId)),
    follow: (id: string) => http.post<unknown>(TASK_ROUTES.follow(id)),
    unfollow: (id: string) => http.delete(TASK_ROUTES.follow(id)),
  },
};

export type Api = typeof api;
