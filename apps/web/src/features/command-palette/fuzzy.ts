/**
 * Local fuzzy matching for ⌘K. A query matches when its characters appear in order (a
 * subsequence). Score rewards: exact/prefix matches, matches at word starts ("cr t" → "Create
 * task"), consecutive runs, and short targets. Returns matched indices for highlighting.
 */
export interface FuzzyMatch {
  score: number;
  /** Indices in the target string that matched, ascending. */
  indices: number[];
}

const isWordStart = (text: string, i: number): boolean => {
  if (i === 0) return true;
  const prev = text[i - 1]!;
  const cur = text[i]!;
  if (/[\s\-_/.·:#@()[\]]/.test(prev)) return true;
  // camelCase / digit boundaries
  return /[a-z]/.test(prev) && /[A-Z]/.test(cur);
};

/** Best-effort optimal subsequence alignment via DP over (query index, target index). */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return { score: 0, indices: [] };
  const t = target.toLowerCase();
  const needle = q.replace(/ /g, '');
  if (needle.length > t.length) return null;

  // Quick reject: is it a subsequence at all?
  let probe = 0;
  for (let i = 0; i < t.length && probe < needle.length; i++) if (t[i] === needle[probe]) probe++;
  if (probe < needle.length) return null;

  const n = needle.length;
  const m = t.length;
  const NEG = -1e9;
  // score[i][j]: best score matching needle[0..i] with needle[i] at target[j]
  const score: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(NEG));
  const from: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-1));

  const charScore = (j: number) => (isWordStart(target, j) ? 10 : 1) + (j === 0 ? 6 : 0);

  for (let j = 0; j < m; j++) if (t[j] === needle[0]) score[0]![j] = charScore(j) - Math.min(j, 12) * 0.25;

  for (let i = 1; i < n; i++) {
    let bestPrev = NEG;
    let bestPrevIdx = -1;
    for (let j = 1; j < m; j++) {
      // best predecessor ending strictly before j (gap)
      const cand = score[i - 1]![j - 1]!;
      if (cand > bestPrev) {
        bestPrev = cand;
        bestPrevIdx = j - 1;
      }
      if (t[j] !== needle[i]) continue;
      const consecutive = score[i - 1]![j - 1]! > NEG ? score[i - 1]![j - 1]! + charScore(j) + 8 : NEG;
      const gapped = bestPrev > NEG ? bestPrev + charScore(j) - 1 : NEG;
      if (consecutive >= gapped && consecutive > NEG) {
        score[i]![j] = consecutive;
        from[i]![j] = j - 1;
      } else if (gapped > NEG) {
        score[i]![j] = gapped;
        from[i]![j] = bestPrevIdx;
      }
    }
  }

  let best = NEG;
  let end = -1;
  for (let j = 0; j < m; j++) {
    if (score[n - 1]![j]! > best) {
      best = score[n - 1]![j]!;
      end = j;
    }
  }
  if (end < 0) return null;

  const indices: number[] = new Array<number>(n);
  for (let i = n - 1, j = end; i >= 0; i--) {
    indices[i] = j;
    j = from[i]![j]!;
  }

  // Whole-string bonuses
  if (t === q) best += 100;
  else if (t.startsWith(q)) best += 40;
  else if (t.includes(q)) best += 20;
  best -= Math.max(0, m - n) * 0.1;
  return { score: best, indices };
}

/** Matches against several fields (title, key, keywords); returns the best with which field won. */
export function fuzzyMatchAny(query: string, fields: readonly string[]): (FuzzyMatch & { field: number }) | null {
  let best: (FuzzyMatch & { field: number }) | null = null;
  fields.forEach((f, field) => {
    const m = fuzzyMatch(query, f);
    // Secondary fields (keywords) count a little less than the primary label.
    if (m && (!best || m.score - field * 2 > best.score)) best = { ...m, score: m.score - field * 2, field };
  });
  return best;
}

/** Ranks items by score, dropping non-matches. Stable for equal scores. */
export function rank<T>(query: string, items: readonly T[], fields: (item: T) => readonly string[]): { item: T; match: FuzzyMatch & { field: number } }[] {
  return items
    .map((item, i) => ({ item, i, match: fuzzyMatchAny(query, fields(item)) }))
    .filter((r): r is { item: T; i: number; match: FuzzyMatch & { field: number } } => r.match !== null)
    .sort((a, b) => b.match.score - a.match.score || a.i - b.i)
    .map(({ item, match }) => ({ item, match }));
}

/** Splits text into highlighted/plain segments for rendering <mark>. */
export function highlightSegments(text: string, indices: readonly number[]): { text: string; match: boolean }[] {
  if (!indices.length) return [{ text, match: false }];
  const set = new Set(indices);
  const out: { text: string; match: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const match = set.has(i);
    const last = out[out.length - 1];
    if (last && last.match === match) last.text += text[i];
    else out.push({ text: text[i]!, match });
  }
  return out;
}
