import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { applyPosition, type Placement } from '../internal/position';
import { describedBy } from './Field';
import { mergeRefs } from '../internal/refs';
import { Portal } from './Portal';

interface TooltipChildProps {
  ref?: Ref<HTMLElement>;
  'aria-describedby'?: string;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
}

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element (button, link). It gets `aria-describedby`. */
  children: ReactElement<TooltipChildProps>;
  placement?: Placement;
  /** Delay before showing, in ms. Default 400. */
  delay?: number;
}

/** Short description shown on hover or focus after a delay. Esc hides it. */
export function Tooltip({ content, children, placement = 'top', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = `ht-tooltip-${useId()}`;
  const anchorRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  const show = () => {
    clear();
    timer.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    setVisible(false);
  }, []);

  useEffect(() => () => clear(), []);

  useLayoutEffect(() => {
    if (visible && anchorRef.current && tipRef.current) applyPosition(anchorRef.current, tipRef.current, placement, 'center', 6);
  }, [visible, placement]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, hide]);

  if (!isValidElement(children)) return children;
  const p = children.props;
  const child = cloneElement(children, {
    ref: mergeRefs(p.ref, (el: HTMLElement | null) => {
      anchorRef.current = el;
    }),
    'aria-describedby': describedBy(p['aria-describedby'], id),
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      p.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      p.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      p.onFocus?.(event);
      show();
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      p.onBlur?.(event);
      hide();
    },
  });

  return (
    <>
      {child}
      <Portal>
        <div ref={tipRef} id={id} role="tooltip" className="ht-tooltip" hidden={!visible} style={{ top: 0, left: 0 }}>
          {content}
        </div>
      </Portal>
    </>
  );
}
