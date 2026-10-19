import { PRIORITY_META, STATUS_META, type Priority, type TaskStatus } from '@hearth/domain';

/**
 * A tiny local "Ask Hearth" interpreter: turns phrases like "overdue design", "urgent tasks for
 * Sara due this week" or "blocked website" into a My tasks filter URL. It's a heuristic — the AI
 * stream can replace it with a server call behind the same function signature.
 */
export interface NlContext {
  tags: readonly { name: string }[];
  teams: readonly { id: string; name: string }[];
  projects: readonly { id: string; name: string }[];
  members: readonly { id: string; name: string }[];
}

export interface NlInterpretation {
  /** Sentence-case description for the palette row: "Show overdue tasks tagged Design". */
  label: string;
  /** Where to go, e.g. "/my-tasks?overdue=1&tag=Design". */
  href: string;
  params: Record<string, string>;
}

const STOP = new Set([
  'show',
  'me',
  'my',
  'all',
  'the',
  'tasks',
  'task',
  'for',
  'in',
  'of',
  'with',
  'that',
  'are',
  'is',
  'and',
  'what',
  'whats',
  'list',
  'find',
  'items',
  'team',
  'project',
  'assigned',
  'to',
  'by',
  'a',
  'on',
]);

const STATUS_WORDS: Record<string, TaskStatus> = {
  blocked: 'BLOCKED',
  stuck: 'BLOCKED',
  review: 'IN_REVIEW',
  reviewing: 'IN_REVIEW',
  progress: 'IN_PROGRESS',
  started: 'IN_PROGRESS',
  doing: 'IN_PROGRESS',
  todo: 'TODO',
  done: 'DONE',
  completed: 'DONE',
  finished: 'DONE',
};

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: 'URGENT',
  critical: 'URGENT',
  high: 'HIGH',
  important: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Finds the entity whose name (or first name) matches one of the words. */
const findByWords = <T extends { name: string }>(
  words: string[],
  items: readonly T[],
  used: Set<number>,
): T | null => {
  for (const item of items) {
    const name = norm(item.name);
    const parts = name.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue;
      // multi-word names ("website relaunch")
      const span = words.slice(i, i + parts.length).join(' ');
      if (
        span === name ||
        (parts.length > 1 && words[i] === parts[0] && name.startsWith(words[i]!) && words[i]!.length >= 4)
      ) {
        for (let k = i; k < i + (span === name ? parts.length : 1); k++) used.add(k);
        return item;
      }
      if (words[i] === name || (words[i]!.length >= 3 && words[i] === parts[0])) {
        used.add(i);
        return item;
      }
    }
  }
  return null;
};

export function interpretQuery(query: string, ctx: NlContext): NlInterpretation | null {
  const text = norm(query);
  const words = text.split(' ').filter(Boolean);
  if (words.length < 2) return null;

  const used = new Set<number>();
  const params: Record<string, string> = {};
  const phrases: string[] = [];
  let status = null as TaskStatus | null;
  let priority = null as Priority | null;

  words.forEach((w, i) => {
    if (w === 'overdue' || w === 'late' || w === 'past-due') {
      params.overdue = '1';
      used.add(i);
    } else if ((w === 'today' && !params.due) || (w === 'due' && words[i + 1] === 'today')) {
      params.due = 'today';
      used.add(i);
      if (w === 'due') used.add(i + 1);
    } else if (w === 'unassigned') {
      params.assignee = 'none';
      used.add(i);
    } else if (STATUS_WORDS[w] && !status) {
      status = STATUS_WORDS[w]!;
      used.add(i);
      if (w === 'progress' && words[i - 1] === 'in') used.add(i - 1);
      if (w === 'review' && words[i - 1] === 'in') used.add(i - 1);
    } else if (PRIORITY_WORDS[w] && !priority) {
      priority = PRIORITY_WORDS[w]!;
      used.add(i);
      if (words[i + 1] === 'priority') used.add(i + 1);
    }
  });

  const pool = words.filter((w, i) => !used.has(i) && !STOP.has(w));
  const poolUsed = new Set<number>();

  const tag = findByWords(pool, ctx.tags, poolUsed);
  const team = tag ? null : findByWords(pool, ctx.teams, poolUsed);
  const project = findByWords(pool, ctx.projects, poolUsed);
  const member = findByWords(pool, ctx.members, poolUsed);

  if (status) params.status = status;
  if (priority) params.priority = priority;
  if (tag) params.tag = tag.name;
  if (team) params.team = team.id;
  if (project) params.project = project.id;
  if (member) params.assignee = member.id;

  // Nothing recognized → this is a plain search, not a question.
  if (Object.keys(params).length === 0) return null;
  const leftovers = pool.filter((_, i) => !poolUsed.has(i));
  if (leftovers.length) params.q = leftovers.join(' ');

  // Sentence-case label in the Hearth voice
  const head: string[] = [];
  if (params.overdue) head.push('overdue');
  if (priority) head.push(PRIORITY_META[priority].label.toLowerCase());
  if (status) head.push(STATUS_META[status].label.toLowerCase());
  phrases.push(`Show ${head.length ? `${head.join(', ')} ` : ''}tasks`);
  if (team) phrases.push(`for the ${team.name} team`);
  if (tag) phrases.push(`tagged ${tag.name}`);
  if (project) phrases.push(`in ${project.name}`);
  if (member) phrases.push(`assigned to ${member.name}`);
  if (params.assignee === 'none') phrases.push('that are unassigned');
  if (params.due === 'today') phrases.push('due today');
  if (params.q) phrases.push(`matching “${params.q}”`);

  const search = new URLSearchParams(params).toString();
  return { label: phrases.join(' '), href: `/my-tasks?${search}`, params };
}
