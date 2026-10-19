import { useEffect, useId, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cx } from '../internal/cx';
import { getFocusable, restoreFocus } from '../internal/focus';
import { lockBodyScroll } from '../internal/scroll-lock';
import { Button } from './Button';
import { Portal } from './Portal';

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  open: boolean;
  /** Called on Esc, overlay click and the close button. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row (right aligned, subtle background). */
  footer?: ReactNode;
  size?: DialogSize;
  /** Element to focus on open. Defaults to the first focusable element in the body, then the close button. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Close when the overlay is clicked. Default true. */
  closeOnOverlayClick?: boolean;
  /** Accessible name for the close button. Default "Close". */
  closeLabel?: string;
  /** Use "alertdialog" for destructive confirmations. */
  role?: 'dialog' | 'alertdialog';
}

/**
 * Modal dialog: portal to body, focus trap, Esc to close, focus returns to the element that was
 * focused when it opened, body scroll is locked while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  closeOnOverlayClick = true,
  closeLabel = 'Close',
  role = 'dialog',
  className,
  onKeyDown,
  ...rest
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const unlock = lockBodyScroll();
    const target =
      initialFocusRef?.current ??
      (bodyRef.current ? getFocusable(bodyRef.current)[0] : undefined) ??
      closeRef.current ??
      dialogRef.current;
    target?.focus();
    return () => {
      unlock();
      restoreFocus(previouslyFocused);
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = getFocusable(dialogRef.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <Portal>
      <div
        className="ht-overlay"
        data-ht-layer=""
        onMouseDown={(event) => {
          if (closeOnOverlayClick && event.target === event.currentTarget) onCloseRef.current();
        }}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          {...rest}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className={cx('ht-dialog', size !== 'md' && `ht-dialog-${size}`, className)}
          onKeyDown={handleKeyDown}
        >
          <div className="ht-dialog-header">
            <div className="ht-dialog-heading">
              <h2 id={titleId} className="ht-dialog-title">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="ht-dialog-desc">
                  {description}
                </p>
              ) : null}
            </div>
            <Button ref={closeRef} variant="ghost" size="sm" icon="x" aria-label={closeLabel} onClick={() => onCloseRef.current()} />
          </div>
          {children !== undefined && children !== null ? (
            <div ref={bodyRef} className="ht-dialog-body">
              {children}
            </div>
          ) : null}
          {footer ? <div className="ht-dialog-footer">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}
