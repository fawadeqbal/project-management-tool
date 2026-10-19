import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyRank, fuzzyRankWeighted } from './fuzzy';

const tasks = [
  { key: 'HRT-182', title: 'Final plan names from Marketing', tags: ['Pricing', 'Marketing'], open: true },
  { key: 'HRT-174', title: 'Update pricing page comparison table', tags: ['Marketing'], open: true },
  {
    key: 'HRT-188',
    title: 'Design pricing page in light and dark mode',
    tags: ['Design', 'Pricing'],
    open: true,
  },
  { key: 'HRT-090', title: 'Old pricing experiment', tags: ['Pricing'], open: false },
];

describe('fuzzy search', () => {
  it('matches subsequences and rejects non-matches', () => {
    expect(fuzzyMatch('prc', 'pricing')?.indices).toEqual([0, 1, 3]);
    expect(fuzzyMatch('xyz', 'pricing')).toBeNull();
  });

  it('ranks by best field', () => {
    expect(fuzzyRank('hrt-188', tasks, (t) => [t.title, t.key])[0]!.item.key).toBe('HRT-188');
  });

  it('weights title hits above tag-only hits and lets boosts break ties', () => {
    const ranked = fuzzyRankWeighted('pric', tasks, {
      primary: (t) => [t.title, t.key],
      secondary: (t) => t.tags,
      boost: (t) => (t.open ? 0 : -15),
    });
    expect(ranked.map((r) => r.item.key)).toEqual(['HRT-188', 'HRT-174', 'HRT-090', 'HRT-182']);
    expect(ranked.at(-1)!.match.primary).toBe(false);
  });
});
