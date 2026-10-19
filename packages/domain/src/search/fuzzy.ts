export interface FuzzyMatch {
  score: number;
  /** Indices of matched characters, for highlighting. */
  indices: number[];
}

const isBoundary = (text: string, i: number) =>
  i === 0 || /[\s\-_/·.]/.test(text[i - 1]!) || (/[a-z]/.test(text[i - 1]!) && /[A-Z]/.test(text[i]!));

/**
 * Subsequence fuzzy matcher tuned for ⌘K: rewards consecutive runs, word starts and prefix
 * matches; exact substrings win. Runs locally in well under 50ms for thousands of items.
 * Returns null when the query is not a subsequence of the text.
 */
export const fuzzyMatch = (query: string, text: string): FuzzyMatch | null => {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const sub = t.indexOf(q);
  if (sub >= 0) {
    const indices = Array.from({ length: q.length }, (_, i) => sub + i);
    return { score: 100 + (sub === 0 ? 50 : isBoundary(text, sub) ? 25 : 0) - sub * 0.1 + q.length, indices };
  }
  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        break;
      }
      ti++;
    }
    if (found < 0) return null;
    const consecutive = indices.length > 0 && indices[indices.length - 1] === found - 1;
    run = consecutive ? run + 1 : 0;
    score += 1 + run * 2 + (isBoundary(text, found) ? 4 : 0);
    indices.push(found);
    ti = found + 1;
  }
  return { score: score - (indices[0] ?? 0) * 0.05, indices };
};

/** Matches a query against several fields (title, key, keywords) and keeps the best. */
export const fuzzyBest = (
  query: string,
  fields: readonly string[],
): (FuzzyMatch & { field: number }) | null => {
  let best: (FuzzyMatch & { field: number }) | null = null;
  fields.forEach((f, field) => {
    const m = fuzzyMatch(query, f);
    if (m && (!best || m.score > best.score)) best = { ...m, field };
  });
  return best;
};

/** Ranks items by fuzzy score; stable for ties. */
export const fuzzyRank = <T>(
  query: string,
  items: readonly T[],
  fieldsOf: (item: T) => string[],
  limit = 50,
) =>
  items
    .map((item, i) => ({ item, i, match: fuzzyBest(query, fieldsOf(item)) }))
    .filter((x): x is { item: T; i: number; match: FuzzyMatch & { field: number } } => x.match !== null)
    .sort((a, b) => b.match.score - a.match.score || a.i - b.i)
    .slice(0, limit);

export interface WeightedFields<T> {
  /** Fields people search by first (title, key). */
  primary: (item: T) => string[];
  /** Supporting fields (project, tags): match alone ranks lower; matching alongside a primary hit adds a little. */
  secondary?: (item: T) => string[];
  /** Small per-item adjustment, e.g. open work above done work. */
  boost?: (item: T) => number;
}

/** Penalty for an item that only matches on a secondary field. */
const SECONDARY_ONLY_PENALTY = 60;
const SECONDARY_ALSO_BONUS = 5;

/**
 * Ranks by primary fields first so a title hit beats a tag hit: "pric" puts "Design pricing
 * page" (title + Pricing tag) above "Final plan names" (tag only). Stable for ties.
 */
export const fuzzyRankWeighted = <T>(
  query: string,
  items: readonly T[],
  fields: WeightedFields<T>,
  limit = 50,
) =>
  items
    .map((item, i) => {
      const primary = fuzzyBest(query, fields.primary(item));
      const secondary = fields.secondary ? fuzzyBest(query, fields.secondary(item)) : null;
      if (!primary && !secondary) return null;
      const base = primary
        ? primary.score + (secondary ? SECONDARY_ALSO_BONUS : 0)
        : secondary!.score - SECONDARY_ONLY_PENALTY;
      const match: FuzzyMatch & { field: number; primary: boolean } = primary
        ? { ...primary, primary: true }
        : { ...secondary!, primary: false };
      return { item, i, score: base + (fields.boost?.(item) ?? 0), match };
    })
    .filter(
      (
        x,
      ): x is {
        item: T;
        i: number;
        score: number;
        match: FuzzyMatch & { field: number; primary: boolean };
      } => x !== null,
    )
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit);
