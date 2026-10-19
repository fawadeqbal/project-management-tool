import { type KeyboardEvent } from 'react';

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const PREV = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Keyboard handler for a roving-tabindex group (tabs, radio groups). Items are found by the
 * `data-roving-item` attribute. Arrow keys wrap, Home/End jump; the newly focused item is
 * activated through `onMove(index)`.
 */
export function handleRovingKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onMove: (index: number) => void,
): void {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-roving-item]'));
  if (items.length === 0) return;
  const current = items.findIndex((el) => el === document.activeElement);
  let next: number;
  if (NEXT.has(event.key)) next = current < 0 ? 0 : (current + 1) % items.length;
  else if (PREV.has(event.key)) next = current <= 0 ? items.length - 1 : current - 1;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  else return;
  event.preventDefault();
  items[next]?.focus();
  onMove(next);
}
