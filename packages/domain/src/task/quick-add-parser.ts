import { addDays, startOfDay } from '../shared/dates';
import type { Priority } from './values';

export interface ParsedQuickAdd {
  title: string;
  /** "@sara" → "sara" — resolved to a user by the application layer. */
  assigneeHandle: string | null;
  /** "#website" → "website" — resolved to a project. */
  projectHandle: string | null;
  priority: Priority | null;
  dueDate: Date | null;
  /** Characters ranges that were recognized, so the UI can highlight them. */
  tokens: { kind: 'assignee' | 'project' | 'priority' | 'due'; text: string }[];
}

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: 'URGENT', u: 'URGENT', '1': 'URGENT', p1: 'URGENT',
  high: 'HIGH', h: 'HIGH', '2': 'HIGH', p2: 'HIGH',
  medium: 'MEDIUM', med: 'MEDIUM', m: 'MEDIUM', '3': 'MEDIUM', p3: 'MEDIUM',
  low: 'LOW', l: 'LOW', '4': 'LOW', p4: 'LOW',
};

/** Index = JS weekday (0 = Sunday). */
const WEEKDAY_ALIASES = [
  ['sun', 'sunday'],
  ['mon', 'monday'],
  ['tue', 'tues', 'tuesday'],
  ['wed', 'weds', 'wednesday'],
  ['thu', 'thur', 'thurs', 'thursday'],
  ['fri', 'friday'],
  ['sat', 'saturday'],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Resolves a single date word relative to today; returns null when the word isn't a date. */
export const parseDateWord = (word: string, today: Date): Date | null => {
  const w = word.toLowerCase();
  const t = startOfDay(today);
  if (w === 'today' || w === 'tod') return t;
  if (w === 'tomorrow' || w === 'tmr' || w === 'tom') return addDays(t, 1);
  const wd = WEEKDAY_ALIASES.findIndex((aliases) => aliases.includes(w));
  if (wd >= 0) {
    const delta = (wd - t.getUTCDay() + 7) % 7 || 7;
    return addDays(t, delta);
  }
  if (w === 'nextweek') return addDays(t, ((1 - t.getUTCDay() + 7) % 7) || 7);
  return null;
};

/**
 * Interpreter for the quick-add mini-language:
 *   "Draft retro agenda @sara #website !high tomorrow"
 *   "Ship pricing ^oct 26"
 * Unknown tokens stay in the title, so typing is never "wrong".
 */
export const parseQuickAdd = (input: string, today: Date): ParsedQuickAdd => {
  const result: ParsedQuickAdd = { title: '', assigneeHandle: null, projectHandle: null, priority: null, dueDate: null, tokens: [] };
  const words = input.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (word.length > 1 && word.startsWith('@') && !result.assigneeHandle) {
      result.assigneeHandle = word.slice(1).toLowerCase();
      result.tokens.push({ kind: 'assignee', text: word });
      continue;
    }
    if (word.length > 1 && word.startsWith('#') && !result.projectHandle) {
      result.projectHandle = word.slice(1).toLowerCase();
      result.tokens.push({ kind: 'project', text: word });
      continue;
    }
    if (word.startsWith('!') && !result.priority) {
      const p = PRIORITY_WORDS[word.slice(1).toLowerCase()];
      if (p) {
        result.priority = p;
        result.tokens.push({ kind: 'priority', text: word });
        continue;
      }
    }
    if (!result.dueDate) {
      // "^oct 26" or "^26 oct" explicit dates
      if (word.startsWith('^')) {
        const a = word.slice(1).toLowerCase();
        const b = (words[i + 1] ?? '').toLowerCase();
        const date = parseMonthDay(a, b, today) ?? parseMonthDay(b, a, today);
        if (date) {
          result.dueDate = date;
          result.tokens.push({ kind: 'due', text: `${word} ${words[i + 1]}` });
          i++;
          continue;
        }
        const single = parseDateWord(a, today);
        if (single) {
          result.dueDate = single;
          result.tokens.push({ kind: 'due', text: word });
          continue;
        }
      }
      // Trailing natural date words: "... tomorrow", "... next week", "... fri"
      const isLast = i === words.length - 1;
      const pair = `${word}${words[i + 1] ?? ''}`.toLowerCase();
      if (pair === 'nextweek' && i === words.length - 2) {
        result.dueDate = parseDateWord('nextweek', today);
        result.tokens.push({ kind: 'due', text: `${word} ${words[i + 1]}` });
        i++;
        continue;
      }
      if (isLast) {
        const d = parseDateWord(word, today);
        if (d) {
          result.dueDate = d;
          result.tokens.push({ kind: 'due', text: word });
          continue;
        }
      }
    }
    kept.push(word);
  }
  result.title = kept.join(' ');
  return result;
};

const parseMonthDay = (monthWord: string, dayWord: string, today: Date): Date | null => {
  const m = MONTHS.findIndex((x) => monthWord.startsWith(x));
  const d = Number(dayWord);
  if (m < 0 || !Number.isInteger(d) || d < 1 || d > 31) return null;
  const t = startOfDay(today);
  let candidate = new Date(Date.UTC(t.getUTCFullYear(), m, d));
  if (candidate.getTime() < t.getTime()) candidate = new Date(Date.UTC(t.getUTCFullYear() + 1, m, d));
  return candidate;
};
