import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { accentVar, type AccentColor } from '../types';
import { Icon, type IconName } from './Icon';

interface NavItemOwnProps<C extends ElementType> {
  label: ReactNode;
  /** Leading icon (default "folder"). Ignored when `dot` is set. */
  icon?: IconName;
  /** Project color square shown instead of an icon. */
  dot?: AccentColor;
  count?: ReactNode;
  /** Marks the item as the current page (`aria-current="page"`). */
  active?: boolean;
  /**
   * Element or component to render, e.g. react-router's `Link` (then pass `to`). Default `a`.
   * Every other prop (`href`, `to`, `onClick`, ...) is passed through to it.
   */
  linkComponent?: C;
}

export type NavItemProps<C extends ElementType = 'a'> = NavItemOwnProps<C> &
  Omit<ComponentPropsWithoutRef<C>, keyof NavItemOwnProps<C>>;

/** Sidebar navigation link. */
export function NavItem<C extends ElementType = 'a'>({
  label,
  icon = 'folder',
  dot,
  count,
  active = false,
  linkComponent,
  className,
  ...rest
}: NavItemProps<C>) {
  const Component: ElementType = linkComponent ?? 'a';
  return (
    <Component {...rest} className={cx('ht-nav', className as string | undefined)} aria-current={active ? 'page' : undefined}>
      {dot ? (
        <span className="ht-nav-dot" aria-hidden="true" style={{ background: accentVar(dot, 'dot') }} />
      ) : (
        <Icon name={icon} />
      )}
      <span className="ht-nav-label">{label}</span>
      {count !== undefined && count !== null ? <span className="ht-nav-count">{count}</span> : null}
    </Component>
  );
}
