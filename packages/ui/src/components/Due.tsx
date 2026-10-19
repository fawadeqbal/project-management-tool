import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon } from './Icon';

export interface DueProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'danger';
  children?: ReactNode;
}

/** Calendar icon + human date. Renders nothing without children. */
export function Due({ tone = 'default', children, className, ...rest }: DueProps) {
  if (children === undefined || children === null || children === '' || children === false) return null;
  return (
    <span {...rest} className={cx('ht-due', tone === 'danger' && 'ht-due-danger', className)}>
      <Icon name="calendar" style={tone === 'danger' ? undefined : { color: 'var(--text-tertiary)' }} />
      {children}
    </span>
  );
}
