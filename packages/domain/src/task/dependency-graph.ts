import { ConflictError } from '../shared/errors';

export interface DependencyEdge {
  blockerId: string;
  blockedId: string;
}

/**
 * Directed graph of finish-to-start dependencies. Guards the invariant "no cycles" that no
 * single Task aggregate can see on its own (a domain service, not an entity method).
 */
export class DependencyGraph {
  private readonly out = new Map<string, Set<string>>();

  constructor(edges: readonly DependencyEdge[]) {
    for (const e of edges) this.link(e.blockerId, e.blockedId);
  }

  private link(a: string, b: string) {
    if (!this.out.has(a)) this.out.set(a, new Set());
    this.out.get(a)!.add(b);
  }

  /** True when `to` is reachable from `from`. */
  reaches(from: string, to: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of this.out.get(n) ?? []) stack.push(m);
    }
    return false;
  }

  /** Throws when adding blocker → blocked would create a cycle (or a self-dependency). */
  assertCanLink(blockerId: string, blockedId: string): void {
    if (blockerId === blockedId) throw new ConflictError('dependency.self', 'A task can’t block itself.');
    if (this.reaches(blockedId, blockerId))
      throw new ConflictError(
        'dependency.cycle',
        'That would create a loop — these tasks would block each other forever. Remove one of the links first.',
      );
  }

  /** Tasks directly blocked by `id`. */
  dependentsOf(id: string): string[] {
    return [...(this.out.get(id) ?? [])];
  }

  /** All tasks transitively blocked by `id` (used to shift dependents when a blocker moves). */
  downstreamOf(id: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>([id]);
    const queue = [...this.dependentsOf(id)];
    while (queue.length) {
      const n = queue.shift()!;
      if (seen.has(n)) continue;
      seen.add(n);
      result.push(n);
      queue.push(...this.dependentsOf(n));
    }
    return result;
  }
}
