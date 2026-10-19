import { useCallback, useSyncExternalStore } from 'react';

/** Phones: below the 768px tablet breakpoint (matches the `max-width: 767px` CSS queries). */
export const PHONE_QUERY = '(max-width: 767px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const matches = (query: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

/** Live `matchMedia(query).matches`; re-renders when it flips (rotation, resize). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener?.('change', notify);
      return () => mq.removeEventListener?.('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}

/** True below 768px — the phone layout (tab bar, mobile rows, swipe, triage). */
export const useIsPhone = () => useMediaQuery(PHONE_QUERY);

export const usePrefersReducedMotion = () => useMediaQuery(REDUCED_MOTION_QUERY);
