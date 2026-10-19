import { Task, type TaskRepository } from '@hearth/domain';

/**
 * In-memory adapter for the TaskRepository port (handler unit tests). Stores snapshots, so a
 * loaded aggregate never shares state with the stored one — like a real database.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly rows = new Map<string, ReturnType<Task['toSnapshot']>>();
  private readonly sequences = new Map<string, number>();

  constructor(private readonly keyPrefixes: Record<string, string> = {}) {}

  /** Test helper: seed the workspace's last issued number. */
  setSequence(workspaceId: string, last: number): void {
    this.sequences.set(workspaceId, last);
  }

  async findById(workspaceId: string, id: string): Promise<Task | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? restore(row) : null;
  }

  async findByNumber(workspaceId: string, number: number): Promise<Task | null> {
    const row = [...this.rows.values()].find((r) => r.workspaceId === workspaceId && r.number === number);
    return row ? restore(row) : null;
  }

  async nextNumber(workspaceId: string): Promise<{ number: number; keyPrefix: string }> {
    const next = (this.sequences.get(workspaceId) ?? 0) + 1;
    this.sequences.set(workspaceId, next);
    return { number: next, keyPrefix: this.keyPrefixes[workspaceId] ?? 'HRT' };
  }

  async save(task: Task): Promise<void> {
    this.rows.set(task.id, task.toSnapshot());
  }

  async delete(task: Task): Promise<void> {
    this.rows.delete(task.id);
  }

  /** Test helper: every stored task. */
  all(): Task[] {
    return [...this.rows.values()].map(restore);
  }
}

const restore = (row: ReturnType<Task['toSnapshot']>): Task => {
  const { id, key: _key, ...props } = row;
  return Task.restore(id, { ...props });
};
