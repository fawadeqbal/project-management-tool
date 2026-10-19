import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon, type IconName } from './Icon';

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  message: ReactNode;
  /** Action label (default "Undo"); `false` hides the action. */
  action?: string | false;
  /** Leading icon (default a green "done" check). */
  icon?: IconName;
  onAction?: () => void;
  onDismiss?: () => void;
  /** Use "alert" for errors so they are announced assertively. */
  politeness?: 'polite' | 'assertive';
}

export function Toast({
  message,
  action = 'Undo',
  icon,
  onAction,
  onDismiss,
  politeness = 'polite',
  className,
  ...rest
}: ToastProps) {
  return (
    <div
      {...rest}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic="true"
      className={cx('ht-toast', className)}
    >
      <Icon name={icon ?? 'status-done'} style={icon ? undefined : { color: 'var(--status-done)' }} />
      <span>{message}</span>
      {action !== false ? (
        <button type="button" className="ht-toast-action" onClick={onAction}>
          {action}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className="ht-toast-close" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}
