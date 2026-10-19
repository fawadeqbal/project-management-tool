import { describe, expect, it } from 'vitest';
import { SWIPE_THRESHOLD, decideSwipe, lockAxis, swipeOffset } from './swipe';

const width = 390;
const past = Math.ceil(width * SWIPE_THRESHOLD);

describe('decideSwipe', () => {
  it('commits right / left once the finger passes ~35% of the width', () => {
    expect(decideSwipe({ dx: past, dy: 0, width })).toBe('right');
    expect(decideSwipe({ dx: -past, dy: 4, width })).toBe('left');
  });

  it('rubber-bands back below the threshold', () => {
    expect(decideSwipe({ dx: past - 2, dy: 0, width })).toBeNull();
    expect(decideSwipe({ dx: -40, dy: 0, width })).toBeNull();
    expect(decideSwipe({ dx: 0, dy: 0, width })).toBeNull();
  });

  it('ignores gestures that are more vertical than horizontal (scrolling)', () => {
    expect(decideSwipe({ dx: 200, dy: 220, width })).toBeNull();
    expect(decideSwipe({ dx: -200, dy: -200, width })).toBeNull();
  });

  it('respects disabled directions and custom thresholds', () => {
    expect(decideSwipe({ dx: -300, dy: 0, width, allowed: { left: false } })).toBeNull();
    expect(decideSwipe({ dx: 300, dy: 0, width, allowed: { left: false } })).toBe('right');
    expect(decideSwipe({ dx: 100, dy: 0, width, threshold: 0.25 })).toBe('right');
  });

  it('never commits without a measurable width', () => {
    expect(decideSwipe({ dx: 300, dy: 0, width: 0 })).toBeNull();
  });
});

describe('lockAxis', () => {
  it('waits until the finger has moved past the slop', () => {
    expect(lockAxis(4, 3)).toBeNull();
  });

  it('locks x only for clearly horizontal movement', () => {
    expect(lockAxis(20, 2)).toBe('x');
    expect(lockAxis(-20, 5)).toBe('x');
    expect(lockAxis(12, 11)).toBe('y');
    expect(lockAxis(2, 30)).toBe('y');
  });
});

describe('swipeOffset', () => {
  it('tracks the finger 1:1, then resists past 60% of the width', () => {
    expect(swipeOffset(100, width)).toBe(100);
    expect(swipeOffset(-100, width)).toBe(-100);
    const far = swipeOffset(width, width);
    expect(far).toBeGreaterThan(width * 0.6);
    expect(far).toBeLessThan(width);
  });

  it('barely moves in a direction with no action', () => {
    expect(Math.abs(swipeOffset(-200, width, { left: false }))).toBeLessThanOrEqual(24);
  });
});
