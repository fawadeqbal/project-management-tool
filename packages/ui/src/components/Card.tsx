import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** none 0 · sm 12px · md 16px (default) · lg 20px */
  padding?: CardPadding;
  children?: ReactNode;
}

/** Surface container: bg-surface, hairline border, radius-lg. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ padding = 'md', className, ...rest }, ref) {
  return <div ref={ref} {...rest} className={cx('ht-surface', `ht-surface-pad-${padding}`, className)} />;
});
