import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { hasAccessibleName, useDevWarning } from '../internal/dev';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. With no children the button becomes square and needs an `aria-label`. */
  icon?: IconName;
  iconRight?: IconName;
  /** Shows a spinner in place of the leading icon and sets `aria-busy`. */
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const iconOnly = Boolean(icon) && (children === undefined || children === null || children === false);
  useDevWarning(
    iconOnly && !hasAccessibleName(rest),
    `Icon-only Button (icon="${String(icon)}") needs an aria-label.`,
  );
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cx(
        'ht-btn',
        `ht-btn-${variant}`,
        size !== 'md' && `ht-btn-${size}`,
        iconOnly && 'ht-btn-icon',
        className,
      )}
      disabled={disabled}
      aria-busy={loading ? true : undefined}
    >
      {loading ? <Icon name="loader" spin /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} /> : null}
    </button>
  );
});
