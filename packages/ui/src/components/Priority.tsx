import { type HTMLAttributes, type SVGProps } from 'react';
import { cx } from '../internal/cx';
import { PRIORITY_LABELS, type PriorityLevel } from '../types';

const FILLED_BARS: Readonly<Record<PriorityLevel, number>> = { urgent: 3, high: 3, medium: 2, low: 1, none: 0 };

export interface PriorityIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  level?: PriorityLevel;
  /** When false the icon is decorative (use when the label is shown next to it). Default true. */
  labelled?: boolean;
}

function PriorityGlyph({ level }: { level: PriorityLevel }) {
  if (level === 'urgent') {
    return (
      <>
        <rect x={1} y={1} width={14} height={14} rx={3.5} fill="var(--priority-urgent)" />
        <rect x={7.1} y={4} width={1.8} height={5.2} rx={0.9} fill="var(--bg-surface)" />
        <rect x={7.1} y={10.6} width={1.8} height={1.8} rx={0.9} fill="var(--bg-surface)" />
      </>
    );
  }
  if (level === 'none') {
    return (
      <>
        {[2, 6.5, 11].map((x) => (
          <rect key={x} x={x} y={7.25} width={3} height={1.5} rx={0.75} fill="var(--priority-bar-empty)" />
        ))}
      </>
    );
  }
  const filled = FILLED_BARS[level];
  return (
    <>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.5}
          y={11 - i * 3.5}
          width={3}
          height={3 + i * 3.5}
          rx={1}
          fill={i < filled ? 'var(--priority-bar)' : 'var(--priority-bar-empty)'}
        />
      ))}
    </>
  );
}

export function PriorityIcon({ level = 'none', labelled = true, className, ...rest }: PriorityIconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      focusable="false"
      {...rest}
      className={cx('ht-icon', className)}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? `Priority: ${PRIORITY_LABELS[level]}` : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <PriorityGlyph level={level} />
    </svg>
  );
}

export interface PriorityProps extends HTMLAttributes<HTMLSpanElement> {
  level?: PriorityLevel;
  /** Show the text label next to the icon. */
  showLabel?: boolean;
}

export function Priority({ level = 'none', showLabel = false, className, ...rest }: PriorityProps) {
  if (!showLabel) {
    return (
      <span {...rest} className={cx('ht-priority', className)}>
        <PriorityIcon level={level} />
      </span>
    );
  }
  return (
    <span {...rest} className={cx('ht-priority', className)}>
      <PriorityIcon level={level} labelled={false} />
      {PRIORITY_LABELS[level]}
    </span>
  );
}
