/**
 * AI is a port. Implementations (a deterministic local summarizer, an Anthropic adapter) are
 * swappable strategies. Output is always a *suggestion* that names its source and needs a person
 * to accept, edit or discard it — AI never writes silently.
 */
export interface AiTaskContext {
  key: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  /** "YYYY-MM-DD" — lets a provider say "due today" / "overdue" without reading a clock. */
  today?: string | null;
  blockedBy: { key: string; title: string; status: string }[];
  subtasks: { title: string; done: boolean }[];
  comments: { author: string; body: string; createdAt: string }[];
}

export interface AiSummary {
  text: string;
  /** "generated from 12 comments" */
  source: string;
  suggestedNextStep: string | null;
}

export interface AiBreakdown {
  subtasks: string[];
  source: string;
}

export interface AiFilterQuery {
  /** Natural language like "overdue design" → a task filter the palette can apply. */
  overdue?: boolean;
  dueToday?: boolean;
  priorities?: string[];
  statuses?: string[];
  tags?: string[];
  teamOrProject?: string | null;
  assignee?: string | null;
  text?: string;
  explanation: string;
}

export interface AiProvider {
  readonly name: string;
  summarizeTask(ctx: AiTaskContext): Promise<AiSummary>;
  breakDownTask(ctx: AiTaskContext): Promise<AiBreakdown>;
}

export const AI_PROVIDER = Symbol('AiProvider');

/** Interprets a short natural-language query into a filter, without any model (fast path for ⌘K). */
export const interpretTaskQuery = (query: string, vocabulary: { tags: string[]; teamsOrProjects: string[]; people: string[] }): AiFilterQuery => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const result: AiFilterQuery = { explanation: '' };
  const adjectives: string[] = [];
  const qualifiers: string[] = [];
  const rest: string[] = [];
  const match = (list: string[], w: string) => list.find((x) => x.toLowerCase() === w || x.toLowerCase().startsWith(w) && w.length >= 3);
  for (const w of words) {
    if (['overdue', 'late', 'behind'].includes(w)) {
      result.overdue = true;
      adjectives.push('overdue');
    } else if (['today', 'due-today'].includes(w)) {
      result.dueToday = true;
      qualifiers.push('due today');
    } else if (['urgent', 'high', 'medium', 'low'].includes(w)) {
      result.priorities = [...(result.priorities ?? []), w.toUpperCase()];
      adjectives.push(`${w}-priority`);
    } else if (['blocked', 'review', 'progress'].includes(w)) {
      const s = w === 'blocked' ? 'BLOCKED' : w === 'review' ? 'IN_REVIEW' : 'IN_PROGRESS';
      result.statuses = [...(result.statuses ?? []), s];
      adjectives.push(w === 'blocked' ? 'blocked' : w === 'review' ? 'in-review' : 'in-progress');
    } else if (['show', 'me', 'my', 'tasks', 'task', 'for', 'the', 'team', 'all', 'in', 'of', 'with', 'are', 'that'].includes(w)) {
      continue;
    } else {
      const team = match(vocabulary.teamsOrProjects, w);
      const tag = match(vocabulary.tags, w);
      const person = match(vocabulary.people, w);
      if (team) {
        result.teamOrProject = team;
        qualifiers.push(`for ${team}`);
      } else if (tag) {
        result.tags = [...(result.tags ?? []), tag];
        qualifiers.push(`tagged ${tag}`);
      } else if (person) {
        result.assignee = person;
        qualifiers.push(`assigned to ${person}`);
      } else rest.push(w);
    }
  }
  if (rest.length) result.text = rest.join(' ');
  result.explanation =
    adjectives.length || qualifiers.length
      ? ['Show', ...adjectives, 'tasks', ...qualifiers].join(' ')
      : `Search tasks for “${query.trim()}”`;
  return result;
};
