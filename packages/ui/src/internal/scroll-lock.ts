let locks = 0;
let previousOverflow = '';

/** Locks body scroll; returns the unlock function. Nested locks are reference counted. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) document.body.style.overflow = previousOverflow;
  };
}
