/**
 * Small application-layer ports for the parts of the projects context that have no aggregate
 * rules worth modelling (favorites, milestones, team lookups). Handlers depend on these tokens;
 * Prisma adapters live in infrastructure/, in-memory fakes in the specs (Dependency Inversion).
 */

export interface FavoriteStore {
  add(userId: string, projectId: string): Promise<void>;
  remove(userId: string, projectId: string): Promise<void>;
}
export const FAVORITE_STORE = Symbol('FavoriteStore');

export interface MilestoneRecord {
  id: string;
  projectId: string;
  name: string;
  date: Date;
  doneAt: Date | null;
  dependsOnTaskIds: string[];
}

export interface MilestoneStore {
  nextId(): string;
  findById(workspaceId: string, id: string): Promise<MilestoneRecord | null>;
  save(milestone: MilestoneRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Ids from `taskIds` that are top-level tasks of the project. */
  tasksInProject(projectId: string, taskIds: string[]): Promise<string[]>;
}
export const MILESTONE_STORE = Symbol('MilestoneStore');

export interface TeamDirectory {
  exists(workspaceId: string, teamId: string): Promise<boolean>;
}
export const TEAM_DIRECTORY = Symbol('TeamDirectory');
