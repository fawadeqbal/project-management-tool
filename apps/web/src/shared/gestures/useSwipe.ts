import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePrefersReducedMotion } from '@/shared/hooks/useMediaQuery';
import {
  SWIPE_THRESHOLD,
  decideSwipe,
  lockAxis,
  swipeOffset,
  type AllowedDirections,
  type SwipeDirection,
} from './swipe';

export interface UseSwipeOptions {
  /** Called once the finger is released past the threshold. */
  onSwipe: (direction: SwipeDirection) => void;
  allowed?: AllowedDirections;
  enabled?: boolean;
  threshold?: number;
  /** Fly the element off-screen before calling `onSwipe` (cards), instead of settling back (rows). */
  exit?: boolean;
}

export interface SwipeState {
  /** Current drawn offset in px. */
  offset: number;
  /** Direction the finger is heading (drives which action is revealed). */
  direction: SwipeDirection | null;
  /** Past the threshold — releasing now commits. */
  armed: boolean;
  /** A finger is down and the gesture is horizontal. */
  dragging: boolean;
}

const SETTLE_MS = 180;

/**
 * Horizontal swipe on any element using pointer events (touch, pen and mouse), no dependencies.
 * The element should have `touch-action: pan-y` so vertical scrolling stays native: once the
 * gesture reads as vertical we let go and the browser scrolls. Below the threshold the element
 * rubber-bands back. With reduced motion the element doesn't animate, it just jumps.
 */
export function useSwipe({
  onSwipe,
  allowed,
  enabled = true,
  threshold = SWIPE_THRESHOLD,
  exit,
}: UseSwipeOptions) {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<SwipeState>({
    offset: 0,
    direction: null,
    armed: false,
    dragging: false,
  });
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; width: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const suppressClick = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reset = useCallback((animate: boolean) => {
    setAnimating(animate);
    setState({ offset: 0, direction: null, armed: false, dragging: false });
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Interactive children (checkbox, menus) keep their own taps.
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    window.clearTimeout(timer.current);
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, width: e.currentTarget.offsetWidth };
    axis.current = null;
    suppressClick.current = false;
    setAnimating(false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (axis.current === null) {
      axis.current = lockAxis(dx, dy);
      if (axis.current === 'y') {
        start.current = null; // a scroll: hands off
        return;
      }
      if (axis.current === 'x') {
        suppressClick.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
      }
    }
    if (axis.current !== 'x') return;
    const committed = decideSwipe({ dx, dy: 0, width: s.width, threshold, allowed });
    const direction: SwipeDirection | null = dx === 0 ? null : dx > 0 ? 'right' : 'left';
    setState({ offset: swipeOffset(dx, s.width, allowed), direction, armed: !!committed, dragging: true });
  };

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = start.current;
    start.current = null;
    if (!s || e.pointerId !== s.id || axis.current !== 'x') {
      axis.current = null;
      return;
    }
    axis.current = null;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dir = cancelled ? null : decideSwipe({ dx, dy, width: s.width, threshold, allowed });
    if (!dir) {
      reset(!reduced);
      return;
    }
    if (exit && !reduced) {
      setAnimating(true);
      setState({
        offset: (dir === 'right' ? 1 : -1) * s.width * 1.2,
        direction: dir,
        armed: true,
        dragging: false,
      });
      timer.current = window.setTimeout(() => {
        reset(false);
        onSwipeRef.current(dir);
      }, SETTLE_MS);
      return;
    }
    onSwipeRef.current(dir);
    reset(!reduced);
  };

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
    /** A drag must not also count as a tap (opening the task). */
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return {
    ...state,
    handlers: enabled ? handlers : {},
    /** Inline transform/transition for the moving element. */
    style: {
      transform: state.offset ? `translate3d(${state.offset}px, 0, 0)` : undefined,
      transition: animating && !reduced ? `transform ${SETTLE_MS}ms ease-out` : 'none',
    },
  };
}
