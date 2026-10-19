import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { accentVar, type AccentColor } from '../types';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  color?: AccentColor;
  children: ReactNode;
}

/** Outlined label with a colored dot; the text carries the meaning. */
export function Tag({ color = 'slate', children, className, ...rest }: TagProps) {
  return (
    <span {...rest} className={cx('ht-tag', className)}>
      <i aria-hidden="true" style={{ background: accentVar(color, 'dot') }} />
      {children}
    </span>
  );
}
