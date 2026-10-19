import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
}

/** Filled pill for state ("On track", "Approval due tomorrow"). Text always carries the meaning. */
export function Badge({ tone = 'neutral', icon, children, className, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx('ht-badge', `ht-badge-${tone}`, icon && 'ht-badge-with-icon', className)}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
