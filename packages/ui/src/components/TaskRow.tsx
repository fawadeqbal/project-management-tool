import { type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { type AccentColor, type PriorityLevel, type Status } from '../types';
import { Avatar } from './Avatar';
import { Due } from './Due';
import { PriorityIcon } from './Priority';
import { StatusPill } from './Status';
import { Tag } from './Tag';
import { TaskCheckbox } from './TaskCheckbox';

export interface TaskRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'title' | 'role'> {
  /** Task key shown in mono, e.g. "HRT-142". */
  id: string;
  title: string;
  priority?: PriorityLevel;
  status?: Status;
  tag?: string;
  tagColor?: AccentColor;
  due?: ReactNode;
  dueTone?: 'default' | 'danger';
  /** Assignee initials. */
  assignee?: string;
  assigneeColor?: AccentColor;
  assigneeName?: string;
  selected?: boolean;
  done?: boolean;
  /** Hides the tag and due columns (narrow layouts). */
  compact?: boolean;
  onToggleDone?: (done: boolean) => void;
  /** Called on click and on Enter. Falls back to `onClick` for pointer activation. */
  onOpen?: () => void;
  /** Extra content at the end of the row (menus, drag handles). */
  trailing?: ReactNode;
  /** DOM id for the row element (the `id` prop is the task key). */
  rowId?: string;
}

function isFromInteractiveChild(event: { target: EventTarget; currentTarget: EventTarget }): boolean {
  const target = event.target as HTMLElement;
  if (target === event.currentTarget) return false;
  return Boolean(target.closest('button, a, input, select, textarea, [role="checkbox"], [role="menuitem"]'));
}

/**
 * One task in a list. Focusable (`tabIndex=0`); Enter opens. The completion checkbox and any
 * `trailing` controls do not trigger `onOpen`.
 */
export function TaskRow({
  id,
  title,
  priority = 'none',
  status = 'todo',
  tag,
  tagColor,
  due,
  dueTone,
  assignee,
  assigneeColor,
  assigneeName,
  selected = false,
  done = false,
  compact = false,
  onToggleDone,
  onOpen,
  onClick,
  onKeyDown,
  trailing,
  rowId,
  className,
  ...rest
}: TaskRowProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || isFromInteractiveChild(event)) return;
    onOpen?.();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (onOpen) onOpen();
      else event.currentTarget.click();
    }
  };
  return (
    <div
      tabIndex={0}
      {...rest}
      id={rowId}
      role="row"
      aria-selected={selected ? true : undefined}
      aria-label={`${id} ${title}`}
      className={cx('ht-taskrow', done && 'ht-taskrow-done', className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span role="cell" className="ht-taskrow-cell">
        <TaskCheckbox
          checked={done}
          label={done ? `Mark ${id} as not done` : `Mark ${id} as done`}
          onChange={(next) => onToggleDone?.(next)}
        />
      </span>
      <span role="cell" className="ht-taskrow-cell">
        <PriorityIcon level={priority} />
      </span>
      <span role="cell" className="ht-taskrow-id">
        {id}
      </span>
      <span role="cell" className="ht-taskrow-title" title={title}>
        {title}
      </span>
      {!compact && tag ? (
        <span role="cell" className="ht-cell-tag">
          <Tag color={tagColor}>{tag}</Tag>
        </span>
      ) : null}
      <span role="cell" className="ht-cell-status">
        <StatusPill status={status} />
      </span>
      {!compact ? (
        <span role="cell" className="ht-cell-due">
          <Due tone={dueTone}>{due}</Due>
        </span>
      ) : null}
      {assignee ? (
        <span role="cell" className="ht-taskrow-cell">
          <Avatar initials={assignee} name={assigneeName} size={24} color={assigneeColor} />
        </span>
      ) : null}
      {trailing ? (
        <span role="cell" className="ht-taskrow-trailing">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
