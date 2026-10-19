import { addDays, diffInDays, startOfDay } from '../shared/dates';
import type { DependencyEdge } from '../task/dependency-graph';

export interface ScheduleNode {
  id: string;
  /** Calendar start date (inclusive). Milestones use start === end. */
  start: Date;
  /** Calendar end/due date (inclusive). */
  end: Date;
  kind?: 'task' | 'milestone';
  done?: boolean;
}

export interface CriticalPathResult {
  /** Ids with zero total float, in dependency order. */
  criticalIds: string[];
  /** Total float (slack) in days per node. */
  floatDays: Record<string, number>;
  /** Earliest the whole plan can finish given durations and links. */
  projectFinish: Date | null;
}

const durationOf = (n: ScheduleNode) => (n.kind === 'milestone' ? 0 : diffInDays(n.start, n.end) + 1);

/**
 * Critical Path Method over finish-to-start links.
 * Forward pass: a node starts no earlier than its scheduled start ("start no earlier than")
 * nor before all its blockers finish. Backward pass from the project finish gives latest
 * start/finish; total float = LS − ES. Zero float = critical (the only thing drawn in brand blue).
 */
export const computeCriticalPath = (nodes: readonly ScheduleNode[], edges: readonly DependencyEdge[]): CriticalPathResult => {
  if (nodes.length === 0) return { criticalIds: [], floatDays: {}, projectFinish: null };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const valid = edges.filter((e) => byId.has(e.blockerId) && byId.has(e.blockedId));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  for (const e of valid) {
    preds.get(e.blockedId)!.push(e.blockerId);
    succs.get(e.blockerId)!.push(e.blockedId);
  }

  const order = topologicalOrder(nodes.map((n) => n.id), preds);
  const origin = startOfDay(new Date(Math.min(...nodes.map((n) => n.start.getTime()))));
  const day = (d: Date) => diffInDays(origin, d);

  // Forward pass (day offsets from origin). EF is exclusive: ES + duration.
  const es: Record<string, number> = {};
  const ef: Record<string, number> = {};
  for (const id of order) {
    const n = byId.get(id)!;
    const afterBlockers = Math.max(0, ...preds.get(id)!.map((p) => ef[p]!));
    es[id] = Math.max(day(n.start), afterBlockers);
    ef[id] = es[id]! + durationOf(n);
  }
  const finish = Math.max(...order.map((id) => ef[id]!));

  // Backward pass.
  const lf: Record<string, number> = {};
  const ls: Record<string, number> = {};
  for (const id of [...order].reverse()) {
    const s = succs.get(id)!;
    lf[id] = s.length ? Math.min(...s.map((x) => ls[x]!)) : finish;
    ls[id] = lf[id]! - durationOf(byId.get(id)!);
  }

  const floatDays: Record<string, number> = {};
  for (const id of order) floatDays[id] = ls[id]! - es[id]!;
  const criticalIds = order.filter((id) => floatDays[id] === 0 && !byId.get(id)!.done);
  return { criticalIds, floatDays, projectFinish: addDays(origin, finish - 1) };
};

/** Kahn's algorithm; nodes in a cycle (should not exist — DependencyGraph prevents it) are appended last. */
const topologicalOrder = (ids: string[], preds: Map<string, string[]>): string[] => {
  const indeg = new Map(ids.map((id) => [id, preds.get(id)!.length]));
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const id of ids) for (const p of preds.get(id)!) succ.get(p)!.push(id);
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const s of succ.get(id)!) {
      indeg.set(s, indeg.get(s)! - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  return out.length === ids.length ? out : [...out, ...ids.filter((id) => !out.includes(id))];
};
