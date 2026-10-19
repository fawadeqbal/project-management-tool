import type { Task } from './task';

/**
 * Repository port (Dependency Inversion): the application layer depends on this interface;
 * infrastructure provides a Prisma adapter, tests provide an in-memory one.
 */
export interface TaskRepository {
  findById(workspaceId: string, id: string): Promise<Task | null>;
  findByNumber(workspaceId: string, number: number): Promise<Task | null>;
  /** Atomically reserves the next task number for the workspace. */
  nextNumber(workspaceId: string): Promise<{ number: number; keyPrefix: string }>;
  save(task: Task): Promise<void>;
  delete(task: Task): Promise<void>;
}

export const TASK_REPOSITORY = Symbol('TaskRepository');
