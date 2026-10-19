export type Placement = 'bottom' | 'top';
export type Align = 'start' | 'center' | 'end';

export interface FloatingPosition {
  top: number;
  left: number;
  placement: Placement;
}

const VIEWPORT_MARGIN = 8;

/**
 * Places a floating element next to an anchor (fixed positioning, viewport coordinates).
 * Flips to the other side when the preferred side does not fit, and clamps horizontally.
 */
export function computePosition(
  anchor: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width'>,
  floating: { width: number; height: number },
  placement: Placement,
  align: Align,
  offset: number,
  viewport: { width: number; height: number },
): FloatingPosition {
  const below = anchor.bottom + offset;
  const above = anchor.top - offset - floating.height;
  const fitsBelow = below + floating.height <= viewport.height - VIEWPORT_MARGIN;
  const fitsAbove = above >= VIEWPORT_MARGIN;

  let side: Placement = placement;
  if (placement === 'bottom' && !fitsBelow && fitsAbove) side = 'top';
  if (placement === 'top' && !fitsAbove && fitsBelow) side = 'bottom';

  let left: number;
  if (align === 'start') left = anchor.left;
  else if (align === 'end') left = anchor.right - floating.width;
  else left = anchor.left + anchor.width / 2 - floating.width / 2;
  const maxLeft = viewport.width - floating.width - VIEWPORT_MARGIN;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, Math.max(VIEWPORT_MARGIN, maxLeft)));

  return { top: side === 'bottom' ? below : above, left, placement: side };
}

/** Measures `anchor` and `floating` and writes the result to the floating element's style. */
export function applyPosition(
  anchor: HTMLElement,
  floating: HTMLElement,
  placement: Placement,
  align: Align,
  offset: number,
): void {
  const rect = floating.getBoundingClientRect();
  const pos = computePosition(
    anchor.getBoundingClientRect(),
    { width: rect.width, height: rect.height },
    placement,
    align,
    offset,
    { width: window.innerWidth, height: window.innerHeight },
  );
  floating.style.top = `${Math.round(pos.top)}px`;
  floating.style.left = `${Math.round(pos.left)}px`;
  floating.dataset.placement = pos.placement;
}
