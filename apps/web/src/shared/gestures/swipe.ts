/**
 * Pure rules for horizontal swipe gestures (task rows, inbox triage cards). No DOM here, so the
 * thresholds are unit-tested and shared by every swipeable surface.
 */

export type SwipeDirection = 'left' | 'right';
export type SwipeAxis = 'x' | 'y';

/** Fraction of the element's width a finger must travel to commit an action. */
export const SWIPE_THRESHOLD = 0.35;
/** Movement (px) before we decide whether the gesture is a horizontal swipe or a vertical scroll. */
export const AXIS_SLOP_PX = 10;
/** A swipe must be clearly horizontal: |dx| must beat |dy| by this factor to lock the x axis. */
export const AXIS_RATIO = 1.2;

export type AllowedDirections = Partial<Record<SwipeDirection, boolean>>;

export interface SwipeInput {
  dx: number;
  dy: number;
  /** Width of the swiped element in px. */
  width: number;
  threshold?: number;
  /** Directions with an action; a missing key counts as allowed. */
  allowed?: AllowedDirections;
}

const isAllowed = (dir: SwipeDirection, allowed?: AllowedDirections) => allowed?.[dir] !== false;

/**
 * Which axis the gesture belongs to, once the finger has moved far enough to tell. `null` means
 * "not yet" (keep watching); `'y'` means it's a scroll — let the browser have it.
 */
export function lockAxis(dx: number, dy: number, slop = AXIS_SLOP_PX): SwipeAxis | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  return ax > ay * AXIS_RATIO ? 'x' : 'y';
}

/**
 * The action a released finger commits to: `'right'`/`'left'` once it travelled at least
 * `threshold` × width horizontally (and more horizontally than vertically), otherwise `null`
 * (rubber-band back).
 */
export function decideSwipe({ dx, dy, width, threshold = SWIPE_THRESHOLD, allowed }: SwipeInput) {
  if (!(width > 0) || dx === 0) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return null;
  const dir: SwipeDirection = dx > 0 ? 'right' : 'left';
  if (!isAllowed(dir, allowed)) return null;
  return Math.abs(dx) >= width * threshold ? dir : null;
}

/**
 * Where the element is drawn for a raw finger offset: 1:1 up to 60% of the width, then with
 * resistance; a direction without an action barely moves (rubber band).
 */
export function swipeOffset(dx: number, width: number, allowed?: AllowedDirections): number {
  if (dx === 0 || !(width > 0)) return 0;
  const dir: SwipeDirection = dx > 0 ? 'right' : 'left';
  const sign = Math.sign(dx);
  const abs = Math.abs(dx);
  if (!isAllowed(dir, allowed)) return sign * Math.min(abs * 0.15, 24);
  const free = width * 0.6;
  if (abs <= free) return dx;
  return sign * (free + (abs - free) * 0.3);
}
