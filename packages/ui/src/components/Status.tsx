import { type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { STATUS_LABELS, type Status } from '../types';
import { Icon, type IconName, type IconProps } from './Icon';

const STATUS_ICON: Readonly<Record<Status, { icon: IconName; color: string }>> = {
  todo: { icon: 'status-todo', color: 'var(--status-todo)' },
  'in-progress': { icon: 'status-progress', color: 'var(--status-progress)' },
  'in-review': { icon: 'status-review', color: 'var(--status-review)' },
  blocked: { icon: 'status-blocked', color: 'var(--status-blocked)' },
  done: { icon: 'status-done', color: 'var(--status-done)' },
};

export interface StatusIconProps extends Omit<IconProps, 'name' | 'label'> {
  status?: Status;
  /** When true, the icon is announced with the status name; otherwise decorative. A string overrides the text. */
  label?: boolean | string;
}

export function StatusIcon({ status = 'todo', size = 16, label, style, ...rest }: StatusIconProps) {
  const s = STATUS_ICON[status];
  const name = typeof label === 'string' ? label : label ? STATUS_LABELS[status] : undefined;
  return <Icon {...rest} name={s.icon} size={size} label={name} style={{ color: s.color, ...style }} />;
}

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status?: Status;
  /** Overrides the default label ("In progress"). */
  label?: string;
}

/** Outlined status pill; the icon carries the color, the text the meaning. */
export function StatusPill({ status = 'todo', label, className, ...rest }: StatusPillProps) {
  return (
    <span {...rest} className={cx('ht-status', className)}>
      <StatusIcon status={status} size={14} />
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
