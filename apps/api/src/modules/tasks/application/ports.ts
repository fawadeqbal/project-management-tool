import type { DependencyEdge, Role, TaskStatus } from '@hearth/domain';

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
  /** Checked for existence when a write sets or changes the project. */
  projectId?: string | null;
  /**
   * The project the task will live in after the write. When given, the section, sprint and parent
   * must belong to it (a section or sprint of another project is never valid).
   */
  targetProjectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  assigneeId?: string | null;
  tagIds?: readonly string[];
}

export type ReferenceEntity = 'Project' | 'Section' | 'Task' | 'Sprint' | 'Member' | 'Tag';

/** The first reference that can't be used: it doesn't exist, or it lives in another project. */
export type ReferenceProblem =
  | { kind: 'missing'; entity: ReferenceEntity; id: string }
  | { kind: 'other_project'; entity: 'Section' | 'Sprint' | 'Task'; id: string; projectId: string | null };

/** Where a task lives (subtasks inherit it). */
export interface TaskLocation {
  projectId: string | null;
  sprintId: string | null;
}

/** What the assignment rule needs to know about a person. */
export interface AssigneeFacts {
  name: string;
  role: Role;
  /** Projects a guest was invited to. */
  projectIds: readonly string[];
}

/** Read-only lookups across the workspace (people, projects, reference checks). */
export interface TaskDirectory {
  /** Active members only — deactivated people can't be assigned or mentioned. */
  activeMembers(workspaceId: string): Promise<MemberHandle[]>;
  /** Non-archived projects, optionally limited to some ids (guests). */
  projects(workspaceId: string, onlyIds?: readonly string[]): Promise<ProjectHandle[]>;
  /** First reference that can't be used, or null when all are valid. */
  checkReferences(workspaceId: string, refs: TaskReferences): Promise<ReferenceProblem | null>;
  /** Where a task of the workspace lives, or null when there is no such task. */
  taskLocation(workspaceId: string, taskId: string): Promise<TaskLocation | null>;
  /** An active member's role and project scope, or null when they aren't an active member. */
  assigneeFacts(workspaceId: string, userId: string): Promise<AssigneeFacts | null>;
  /** Of `userIds`, the active members who can see something in `projectId`. */
  usersWhoCanSee(workspaceId: string, projectId: string | null, userIds: readonly string[]): Promise<string[]>;
}

export interface TaskOrdering {
  boardPosition: number;
  listPosition: number;
}

/** Columns and relations around the aggregate: ordering, tags, followers, comments, dependencies. */
export interface TaskRelations {
  /** Highest positions in the task's board column (project + status) and list (project + parent). */
  lastPositions(
    workspaceId: string,
    scope: { projectId: string | null; status: TaskStatus; parentId: string | null },
  ): Promise<{ board: number | null; list: number | null }>;
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
  createComment(input: {
    taskId: string;
    authorId: string;
    body: string;
    parentId: string | null;
    createdAt: Date;
  }): Promise<{ id: string }>;
}

export const TASK_DIRECTORY = Symbol('TaskDirectory');
export const TASK_RELATIONS = Symbol('TaskRelations');
