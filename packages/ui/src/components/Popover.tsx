import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { cx } from '../internal/cx';
import { getFocusable } from '../internal/focus';
import { applyPosition, type Align, type Placement } from '../internal/position';
import { Portal } from './Portal';

export interface PopoverTriggerProps {
  ref: (el: HTMLElement | null) => void;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
  'aria-controls': string | undefined;
}

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element the popover is positioned against. Use this or `renderTrigger`. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Renders the trigger; spread the given props onto a button. */
  renderTrigger?: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end' | 'center';
  placement?: Placement;
  /** Gap between anchor and popover in px. Default 6. */
  offset?: number;
  /** Move focus into the popover when it opens. Default true. */
  autoFocus?: boolean;
  /** Make the popover at least as wide as the anchor. */
  matchAnchorWidth?: boolean;
}

/**
 * Floating surface anchored to an element. Portals to body, closes on outside click and Esc
 * (Esc returns focus to the anchor), repositions on scroll and resize.
 */
export function Popover({
  open,
  onOpenChange,
  anchorRef,
  renderTrigger,
  children,
  align = 'start',
  placement = 'bottom',
  offset = 6,
  autoFocus = true,
  matchAnchorWidth = false,
  className,
  style,
  id,
  ...rest
}: PopoverProps) {
  const generatedId = useId();
  const popoverId = id ?? `ht-popover-${generatedId}`;
  const floatingRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const getAnchor = useCallback(() => anchorRef?.current ?? triggerRef.current, [anchorRef]);

  const reposition = useCallback(() => {
    const anchor = getAnchor();
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    if (matchAnchorWidth) floating.style.minWidth = `${anchor.getBoundingClientRect().width}px`;
    applyPosition(anchor, floating, placement, align as Align, offset);
  }, [getAnchor, placement, align, offset, matchAnchorWidth]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    if (autoFocus && floatingRef.current) {
      const target = getFocusable(floatingRef.current)[0] ?? floatingRef.current;
      target.focus();
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (floatingRef.current?.contains(target)) return;
      if (getAnchor()?.contains(target)) return;
      onOpenChangeRef.current(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Mark handled so an enclosing Dialog does not also close.
      event.preventDefault();
      getAnchor()?.focus();
      onOpenChangeRef.current(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, autoFocus, getAnchor]);

  const setTriggerRef = useCallback((el: HTMLElement | null) => {
    triggerRef.current = el;
  }, []);

  return (
    <>
      {renderTrigger?.({
        ref: setTriggerRef,
        onClick: () => onOpenChange(!open),
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        'aria-controls': open ? popoverId : undefined,
      })}
      {open ? (
        <Portal>
          <div
            ref={floatingRef}
            tabIndex={-1}
            {...rest}
            id={popoverId}
            data-ht-layer=""
            className={cx('ht-popover', className)}
            style={{ top: 0, left: 0, ...style }}
          >
            {children}
          </div>
        </Portal>
      ) : null}
    </>
  );
}
