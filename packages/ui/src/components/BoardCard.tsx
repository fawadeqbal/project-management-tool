import { forwardRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { type AccentColor, type PriorityLevel } from '../types';
import { Avatar } from './Avatar';
import { Due } from './Due';
import { Icon } from './Icon';
import { PriorityIcon } from './Priority';
import { Tag } from './Tag';

export interface BoardCardTag {
  label: string;
  color?: AccentColor;
}

export interface BoardCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'title'> {
  /** Task key, e.g. "HRT-188". */
  id: string;
  title: ReactNode;
  priority?: PriorityLevel;
  tags?: readonly BoardCardTag[];
  due?: ReactNode;
  dueTone?: 'default' | 'danger';
  comments?: number;
  assignee?: string;
  assigneeColor?: AccentColor;
  assigneeName?: string;
  /** Lifted while dragging (tilted, stronger shadow). */
  dragging?: boolean;
  /** Dimmed (e.g. the placeholder left behind while dragging). */
  muted?: boolean;
  /** DOM id for the card element (the `id` prop is the task key). */
  cardId?: string;
}

/**
 * Kanban card. Forwards its ref and spreads extra props so dnd-kit's `attributes`, `listeners`
 * and `style` can be attached directly. Enter triggers `onClick` unless a spread key handler
 * (e.g. dnd-kit's keyboard sensor) already handled the key.
 */
export const BoardCard = forwardRef<HTMLDivElement, BoardCardProps>(function BoardCard(
  {
    id,
    title,
    priority = 'none',
    tags,
    due,
    dueTone,
    comments,
    assignee,
    assigneeColor,
    assigneeName,
    dragging = false,
    muted = false,
    cardId,
    className,
    style,
    onClick,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const interactive = Boolean(onClick);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' && interactive) {
      event.preventDefault();
      event.currentTarget.click();
    }
  };
  return (
    <div
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...rest}
      id={cardId}
      className={cx('ht-card', dragging && 'ht-card-dragging', className)}
      style={{ opacity: muted ? 0.72 : undefined, ...style }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="ht-card-top">
        <span className="ht-card-id">{id}</span>
        <PriorityIcon level={priority} />
      </div>
      <div className="ht-card-title">{title}</div>
      {tags && tags.length > 0 ? (
        <div className="ht-card-tags">
          {tags.map((t, i) => (
            <Tag key={`${t.label}-${i}`} color={t.color}>
              {t.label}
            </Tag>
          ))}
        </div>
      ) : null}
      <div className="ht-card-meta">
        <Due tone={dueTone}>{due}</Due>
        {comments !== undefined ? (
          <span className="ht-due">
            <Icon name="comment" style={{ color: 'var(--text-tertiary)' }} />
            {comments}
            <span className="ht-sr-only">{comments === 1 ? ' comment' : ' comments'}</span>
          </span>
        ) : null}
        <span className="ht-spacer" />
        {assignee ? <Avatar initials={assignee} name={assigneeName} size={24} color={assigneeColor} /> : null}
      </div>
    </div>
  );
});
