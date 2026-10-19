import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { type Status } from '../types';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { StatusIcon } from './Status';

export interface GroupHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  label: ReactNode;
  count?: ReactNode;
  status?: Status;
  icon?: IconName;
  iconColor?: string;
  collapsed?: boolean;
  /** Makes the header a collapse toggle (a real button with `aria-expanded`). */
  onToggle?: () => void;
  /** Shows an "Add task" button. */
  onAdd?: () => void;
  /** Accessible name for the add button. Default "Add task to <label>". */
  addLabel?: string;
  /** id of the rows region the toggle controls. */
  controls?: string;
  /** "table" (default) renders row/rowheader roles for use inside a role=table list. */
  semantics?: 'table' | 'none';
}

export function GroupHeader({
  label,
  count,
  status,
  icon,
  iconColor,
  collapsed = false,
  onToggle,
  onAdd,
  addLabel,
  controls,
  semantics = 'table',
  className,
  ...rest
}: GroupHeaderProps) {
  const table = semantics === 'table';
  const content = (
    <>
      <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} style={{ color: 'var(--text-tertiary)' }} />
      {status ? (
        <StatusIcon status={status} />
      ) : icon ? (
        <Icon name={icon} style={{ color: iconColor ?? 'var(--text-secondary)' }} />
      ) : null}
      <span>{label}</span>
      <span className="ht-group-count">{count}</span>
    </>
  );
  return (
    <div {...rest} role={table ? 'row' : undefined} className={cx('ht-group', className)}>
      <span role={table ? 'rowheader' : undefined} className="ht-group-static">
        {onToggle ? (
          <button type="button" className="ht-group-toggle" aria-expanded={!collapsed} aria-controls={controls} onClick={onToggle}>
            {content}
          </button>
        ) : (
          content
        )}
      </span>
      {onAdd ? (
        <span role={table ? 'cell' : undefined}>
          <Button
            variant="ghost"
            size="sm"
            icon="plus"
            className="ht-group-add"
            aria-label={addLabel ?? (typeof label === 'string' ? `Add task to ${label}` : 'Add task')}
            onClick={onAdd}
          />
        </span>
      ) : null}
    </div>
  );
}
