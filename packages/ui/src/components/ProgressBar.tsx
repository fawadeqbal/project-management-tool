import { type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** 0-100; clamped. */
  value: number;
  /** Accessible name. */
  label: string;
  tone?: 'brand' | 'success';
  /** Track height in px. Default 4. */
  height?: number;
}

export function ProgressBar({ value, label, tone = 'brand', height, className, style, ...rest }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      {...rest}
      className={cx('ht-progress', className)}
      style={{ height, ...style }}
    >
      <i style={{ width: `${v}%`, background: tone === 'success' ? 'var(--status-done)' : undefined }} />
    </div>
  );
}
