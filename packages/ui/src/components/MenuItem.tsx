import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon, type IconName } from './Icon';
import { Kbd } from './Kbd';

export interface MenuItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onSelect'> {
  label: ReactNode;
  icon?: IconName;
  /** CSS color for the icon, e.g. "var(--brand-primary)". */
  iconColor?: string;
  shortcut?: string | readonly string[];
  /** Secondary text after the label ("overdue 2 days"). */
  hint?: ReactNode;
  /** Keyboard/pointer highlight (the active descendant). */
  highlighted?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
}

/** Option inside a listbox (menus, command palette). */
export function MenuItem({
  label,
  icon,
  iconColor,
  shortcut,
  hint,
  highlighted = false,
  disabled = false,
  danger = false,
  onSelect,
  onClick,
  className,
  ...rest
}: MenuItemProps) {
  return (
    <div
      {...rest}
      role="option"
      aria-selected={highlighted}
      aria-disabled={disabled || undefined}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('ht-menuitem', danger && 'ht-menuitem-danger', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled && !event.defaultPrevented) onSelect?.();
      }}
    >
      {icon ? <Icon name={icon} style={iconColor ? { color: iconColor } : undefined} /> : null}
      <span className="ht-menuitem-label">
        {label}
        {hint ? <span className="ht-menuitem-hint">{'  ·  '}{hint}</span> : null}
      </span>
      {shortcut ? <Kbd keys={shortcut} aria-hidden="true" /> : null}
    </div>
  );
}

export interface MenuHeadingProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Section heading inside a listbox. */
export function MenuHeading({ className, ...rest }: MenuHeadingProps) {
  return <div role="presentation" {...rest} className={cx('ht-menu-heading', className)} />;
}
