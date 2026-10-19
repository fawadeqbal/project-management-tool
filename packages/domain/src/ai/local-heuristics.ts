import { diffInDays, parseDateOnly } from '../shared/dates';
import type { AiBreakdown, AiSummary, AiTaskContext } from './ai-provider';

/**
 * Deterministic, offline "AI": a summary and a breakdown built from the task's own data with
 * plain rules. Used by the local provider and as the fallback when a model is unavailable.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const clip = (s: string, max = 140) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const quoted = (titles: string[]) => titles.map((t) => `“${t}”`);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export const summarySource = (ctx: Pick<AiTaskContext, 'comments' | 'subtasks'>): string =>
  ctx.comments.length ? `generated from ${plural(ctx.comments.length, 'comment')}` : ctx.subtasks.length ? `generated from ${plural(ctx.subtasks.length, 'subtask')}` : 'generated from the task details';

/** Strips @mentions and trailing chatter so a comment reads as a status line. */
const commentGist = (body: string) => clip(body.replace(/(^|\s)@[\w.-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[—–-]\s*/, ''));

export const summarizeTaskLocally = (ctx: AiTaskContext): AiSummary => {
  const sentences: string[] = [];
  const done = ctx.subtasks.filter((s) => s.done).map((s) => s.title);
  const open = ctx.subtasks.filter((s) => !s.done).map((s) => s.title);
  const blockers = ctx.blockedBy.filter((b) => b.status !== 'DONE');

  if (done.length) sentences.push(`${list(quoted(done))} ${done.length === 1 ? 'is' : 'are'} done.`);
  if (open.length) sentences.push(`Still open: ${list(quoted(open))}.`);
  if (!ctx.subtasks.length) {
    const status: Record<string, string> = { TODO: 'Not started yet.', IN_PROGRESS: 'Work is in progress.', IN_REVIEW: 'Waiting on review.', BLOCKED: 'Marked as blocked.', DONE: 'Completed.' };
    sentences.push(status[ctx.status] ?? '');
  }

  const latest = [...ctx.comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latest) sentences.push(`Latest from ${latest.author.split(' ')[0]}: ${commentGist(latest.body)}${/[.!?…]$/.test(commentGist(latest.body)) ? '' : '.'}`);

  if (blockers.length) sentences.push(`Blocked until ${list(blockers.map((b) => `“${b.title}” (${b.key})`))} ${blockers.length === 1 ? 'is' : 'are'} done.`);

  let overdueDays = 0;
  let dueToday = false;
  if (ctx.dueDate && ctx.today && ctx.status !== 'DONE') {
    const delta = diffInDays(parseDateOnly(ctx.today), parseDateOnly(ctx.dueDate));
    if (delta < 0) overdueDays = -delta;
    dueToday = delta === 0;
    if (overdueDays) sentences.push(`It’s ${plural(overdueDays, 'day')} overdue.`);
    else if (dueToday) sentences.push('It’s due today.');
  }

  let next: string | null = null;
  if (ctx.status === 'DONE') next = null;
  else if (blockers.length && done.length) next = `ship what’s done (${lowerFirst(done[0]!)}) behind a flag while ${list(blockers.map((b) => b.key))} ${blockers.length === 1 ? 'is' : 'are'} open`;
  else if (blockers.length) next = `check in on ${blockers[0]!.key} or work around it`;
  else if (overdueDays) next = `agree a new due date or cut scope`;
  else if (open.length) next = `finish “${open[0]}”`;
  else if (ctx.subtasks.length && ctx.status !== 'IN_REVIEW') next = 'move it to review';
  else if (ctx.status === 'IN_REVIEW') next = 'get a decision from the reviewer';
  else if (ctx.status === 'TODO') next = 'break it down into subtasks and pick a first step';

  if (next) sentences.push(`Suggested next step: ${next}.`);
  return { text: sentences.filter(Boolean).join(' '), source: summarySource(ctx), suggestedNextStep: next ? upperFirst(next) : null };
};

type TaskKind = 'design' | 'content' | 'engineering' | 'qa' | 'meeting' | 'research' | 'general';

const KIND_WORDS: [TaskKind, RegExp][] = [
  ['qa', /\b(qa|test|tests|testing|audit|accessibility|verify|regression|proofread)\b/i],
  ['meeting', /\b(meeting|workshop|agenda|retro|retrospective|kickoff|offsite|walkthrough|review session|sync)\b/i],
  ['content', /\b(write|copy|draft|content|blog|newsletter|docs?|email|emails|guide|localize|translate)\b/i],
  ['design', /\b(design|mockups?|comps|wireframes?|ui|layout|illustrations?|icons?|moodboard|visual)\b/i],
  ['engineering', /\b(build|implement|fix|api|set up|setup|migrate|refactor|component|bug|crash|deploy|integrate|sync|endpoint|cdn)\b/i],
  ['research', /\b(research|interview|interviews|analy[sz]e|investigate|explore|define|map)\b/i],
];

const LEAD_VERBS = /^(design|write|draft|build|implement|fix|set up|setup|create|update|review|prepare|plan|migrate|refactor|qa|test|audit|define|research|add|make|ship|collect|verify|localize|refresh|approve)\s+/i;

export const taskKindOf = (title: string, description: string | null = null): TaskKind => {
  for (const [kind, re] of KIND_WORDS) if (re.test(title)) return kind;
  for (const [kind, re] of KIND_WORDS) if (description && re.test(description)) return kind;
  return 'general';
};

const TEMPLATES: Record<TaskKind, (subject: string) => string[]> = {
  design: (s) => [`Gather references and requirements for ${s}`, `Sketch layout options for ${s}`, `Create high-fidelity comps`, `Check contrast and accessibility`, `Review with stakeholders`, `Prepare handoff specs`],
  content: (s) => [`Outline the key messages for ${s}`, `Write the first draft`, `Edit for voice and clarity`, `Get a review from a second reader`, `Publish or hand off the final copy`],
  engineering: (s) => [`Spike the approach and list edge cases for ${s}`, `Implement the core change`, `Add tests`, `Open a pull request for review`, `Verify on staging`, `Release behind a flag`],
  qa: (s) => [`Write a test plan for ${s}`, `Run the checks on every supported platform`, `Log the issues found`, `Retest the fixes`, `Sign off and share results`],
  meeting: (s) => [`Define the goals for ${s}`, `Draft the agenda`, `Invite attendees and book a room`, `Prepare materials`, `Share notes and action items`],
  research: (s) => [`Frame the questions for ${s}`, `Collect sources and data`, `Synthesize findings`, `Share a summary with recommendations`],
  general: (s) => [`Clarify the goal and what done looks like for ${s}`, `List the steps and owners`, `Do the first step`, `Review the result`, `Close the loop with the team`],
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Bullet or numbered lines in the description become subtasks first ("- Audit links"). */
const descriptionSteps = (description: string | null): string[] =>
  (description ?? '')
    .split('\n')
    .map((l) => l.match(/^\s*(?:[-*•]|\d+[.)]|\[ \])\s+(.+)$/)?.[1]?.trim())
    .filter((l): l is string => !!l && l.length > 2)
    .map((l) => upperFirst(clip(l, 120)));

export const breakDownTaskLocally = (ctx: AiTaskContext): AiBreakdown => {
  const fromDescription = descriptionSteps(ctx.description);
  const subject = lowerFirst(ctx.title.replace(LEAD_VERBS, '').replace(/\s+[—–-]\s+.*$/, '').trim()) || 'this task';
  const kind = taskKindOf(ctx.title, ctx.description);
  const existing = new Set(ctx.subtasks.map((s) => norm(s.title)));
  const candidates = [...fromDescription, ...TEMPLATES[kind](clip(subject, 60))];
  const seen = new Set<string>();
  const subtasks: string[] = [];
  for (const c of candidates) {
    const k = norm(c);
    if (seen.has(k) || existing.has(k)) continue;
    seen.add(k);
    subtasks.push(c);
    if (subtasks.length === 6) break;
  }
  return {
    subtasks: subtasks.slice(0, Math.max(3, Math.min(6, subtasks.length))),
    source: fromDescription.length ? `generated from the description and title` : `generated from the title (${kind === 'general' ? 'general' : kind} task)`,
  };
};
