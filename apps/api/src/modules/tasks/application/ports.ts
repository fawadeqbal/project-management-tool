import type { DependencyEdge, TaskStatus } from '@hearth/domain';

/**
 * Small application-layer ports for everything a task command needs besides the aggregate
 * itself (Interface Segregation: handlers depend on these, never on Prisma). Prisma adapters
 * live in ../infrastructure; in-memory adapters back the handler unit tests.
 */

/** A workspace member as quick add and @mentions see them. */
export interface MemberHandle {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface ProjectHandle {
  id: string;
  name: string;
}

/** Ids a task may point at; each must belong to the actor's workspace. */
export interface TaskReferences {
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  assigneeId?: string | null;
  tagIds?: readonly string[];
}

export interface MissingReference {
  entity: 'Project' | 'Section' | 'Task' | 'Sprint' | 'Member' | 'Tag';
  id: string;
}

/** Read-only lookups across the workspace (people, projects, reference checks). */
export interface TaskDirectory {
  /** Active members only — deactivated people can't be assigned or mentioned. */
  activeMembers(workspaceId: string): Promise<MemberHandle[]>;
  /** Non-archived projects, optionally limited to some ids (guests). */
  projects(workspaceId: string, onlyIds?: readonly string[]): Promise<ProjectHandle[]>;
  /** First reference that doesn't exist in the workspace, or null when all are valid. */
  findMissingReference(workspaceId: string, refs: TaskReferences): Promise<MissingReference | null>;
  /** Project of a parent task (subtasks inherit it). */
  projectOfTask(workspaceId: string, taskId: string): Promise<string | null | undefined>;
}

export interface TaskOrdering {
  boardPosition: number;
  listPosition: number;
}

/** Columns and relations around the aggregate: ordering, tags, followers, comments, dependencies. */
export interface TaskRelations {
  /** Highest positions in the task's board column (project + status) and list (project + parent). */
  lastPositions(workspaceId: string, scope: { projectId: string | null; status: TaskStatus; parentId: string | null }): Promise<{ board: number | null; list: number | null }>;
  positionsOf(workspaceId: string, ids: readonly string[]): Promise<Map<string, TaskOrdering>>;
  setOrdering(taskId: string, ordering: Partial<TaskOrdering>): Promise<void>;
  setEpic(taskId: string, epic: string | null): Promise<void>;
  replaceTags(taskId: string, tagIds: readonly string[]): Promise<void>;
  follow(taskId: string, userIds: readonly string[]): Promise<void>;
  unfollow(taskId: string, userId: string): Promise<void>;
  subtaskStatuses(parentId: string): Promise<TaskStatus[]>;
  /** Every dependency edge between tasks of the workspace (cycles may cross projects). */
  dependencyEdges(workspaceId: string): Promise<DependencyEdge[]>;
  addDependency(edge: DependencyEdge): Promise<void>;
  /** Returns false when the edge didn't exist. */
  removeDependency(edge: DependencyEdge): Promise<boolean>;
  findComment(taskId: string, commentId: string): Promise<{ id: string; authorId: string } | null>;
  createComment(input: { taskId: string; authorId: string; body: string; parentId: string | null; createdAt: Date }): Promise<{ id: string }>;
}

export const TASK_DIRECTORY = Symbol('TaskDirectory');
export const TASK_RELATIONS = Symbol('TaskRelations');
