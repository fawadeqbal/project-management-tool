import { describe, expect, it } from 'vitest';
import { fuzzyMatch, highlightSegments, rank } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches subsequences and rejects non-matches', () => {
    expect(fuzzyMatch('crt', 'Create task')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'Create task')).toBeNull();
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('returns matched indices for highlighting', () => {
    const m = fuzzyMatch('ct', 'Create task')!;
    expect(m.indices).toEqual([0, 7]);
    expect(highlightSegments('Create task', m.indices)).toEqual([
      { text: 'C', match: true },
      { text: 'reate ', match: false },
      { text: 't', match: true },
      { text: 'ask', match: false },
    ]);
  });
});

describe('rank', () => {
  const titles = ['Go to Inbox', 'Toggle theme', 'Create task', 'Show keyboard shortcuts', 'Go to Home'];
  const order = (q: string) => rank(q, titles, (t) => [t]).map((r) => r.item);

  it('puts prefix and exact matches first', () => {
    expect(order('create')[0]).toBe('Create task');
    expect(order('go to h')[0]).toBe('Go to Home');
  });

  it('rewards word starts over scattered letters', () => {
    // "tt" = Toggle Theme (two word starts) beats letters buried inside other words.
    expect(order('tt')[0]).toBe('Toggle theme');
    // "ks" = Keyboard Shortcuts
    expect(order('ks')[0]).toBe('Show keyboard shortcuts');
  });

  it('ranks consecutive runs above gapped matches', () => {
    const r = rank('inb', ['Mobile inbox triage', 'In the backlog'], (t) => [t]);
    expect(r[0]!.item).toBe('Mobile inbox triage');
  });

  it('searches secondary fields like keys and keywords', () => {
    const tasks = [
      { title: 'Review Q3 analytics dashboard', key: 'HRT-118' },
      { title: 'Design pricing page', key: 'HRT-188' },
    ];
    expect(rank('hrt-188', tasks, (t) => [t.title, t.key])[0]!.item.key).toBe('HRT-188');
  });
});
