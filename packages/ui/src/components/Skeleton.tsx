import { type CSSProperties, type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { Icon } from './Icon';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  /** Border radius; a number is px. Default var(--radius-md). */
  radius?: CSSProperties['borderRadius'];
}

/** Loading placeholder. Decorative; announce loading state on the container (`aria-busy`). */
export function Skeleton({ width = '100%', height = 12, radius, className, style, ...rest }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={cx('ht-skeleton', className)}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
  /** Accessible status text. Default "Loading". */
  label?: string;
}

export function Spinner({ size = 16, label = 'Loading', className, ...rest }: SpinnerProps) {
  return (
    <span role="status" {...rest} className={cx('ht-spinner', className)}>
      <Icon name="loader" size={size} spin />
      <span className="ht-sr-only">{label}</span>
    </span>
  );
}
