import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import {
  Avatar,
  Icon,
  PriorityIcon,
  StatusIcon,
  TaskCheckbox,
  accentVar,
  toUiPriority,
  toUiStatus,
} from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { useSwipe } from '@/shared/gestures/useSwipe';
import type { SwipeDirection } from '@/shared/gestures/swipe';
import { dueInfo } from './dates';
import { statusLabel } from './meta';
import styles from './task-list.module.css';

export interface MobileTaskRowProps {
  task: TaskDto;
  rowId?: string;
  selected?: boolean;
  /** Hide the assignee avatar ("my" lists: it's always you). */
  hideAssignee?: boolean;
  pending?: boolean;
  onToggleDone: () => void;
  onSnooze: () => void;
  onOpen: () => void;
  onFocus?: () => void;
}

const fromInteractiveChild = (e: { target: EventTarget; currentTarget: EventTarget }) => {
  const target = e.target as HTMLElement;
  return target !== e.currentTarget && !!target.closest('button, a, input, [role="checkbox"]');
};

/**
 * Phone task row (MobileTasks.dc.html): 44×44 checkbox, 16px title on up to two lines, a meta
 * line (key · due · status · tag), priority. Swipe right completes, swipe left snoozes to
 * tomorrow — the action's icon is revealed under the finger. Swipe is an enhancement: the
 * checkbox, Enter-to-open and the task detail cover keyboard and screen-reader users.
 */
export const MobileTaskRow = memo(function MobileTaskRow({
  task,
  rowId,
  selected,
  hideAssignee,
  pending,
  onToggleDone,
  onSnooze,
  onOpen,
  onFocus,
}: MobileTaskRowProps) {
  const done = task.status === 'DONE';
  const due = dueInfo(task.dueDate, { done });
  const tag = task.tags[0];
  const swipe = useSwipe({
    enabled: !pending,
    allowed: { right: true, left: !done },
    onSwipe: (dir: SwipeDirection) => (dir === 'right' ? onToggleDone() : onSnooze()),
  });

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || fromInteractiveChild(e)) return;
    onOpen();
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.key !== 'Enter') return;
    e.preventDefault();
    onOpen();
  };

  const revealing = swipe.direction && swipe.offset !== 0 ? swipe.direction : null;

  return (
    <div
      id={rowId}
      role="row"
      tabIndex={0}
      data-task-id={task.id}
      data-swipe-row=""
      aria-label={`${task.key} ${task.title}`}
      aria-selected={selected ? true : undefined}
      aria-busy={pending || undefined}
      className={styles.mRow}
      data-done={done || undefined}
      data-pending={pending || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      {...swipe.handlers}
    >
      {revealing ? (
        <div
          className={styles.mReveal}
          data-action={revealing === 'right' ? (done ? 'reopen' : 'complete') : 'snooze'}
          data-armed={swipe.armed || undefined}
          aria-hidden="true"
        >
          <Icon name={revealing === 'right' ? (done ? 'undo' : 'check') : 'clock'} size={22} />
          <span>{revealing === 'right' ? (done ? 'Reopen' : 'Done') : 'Tomorrow'}</span>
        </div>
      ) : null}
      <div
        role="presentation"
        className={styles.mSurface}
        data-dragging={swipe.dragging || undefined}
        style={swipe.style}
      >
        <span role="cell" className={styles.mCheck}>
          <TaskCheckbox
            checked={done}
            label={done ? `Mark ${task.key} as not done` : `Mark ${task.key} as done`}
            onChange={onToggleDone}
            disabled={pending}
          />
        </span>
        <span role="cell" className={styles.mBody}>
          <span className={styles.mTitle}>{task.title}</span>
          <span className={styles.mMeta}>
            <span className={styles.mKey}>{task.key}</span>
            {due ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={styles.mDue} data-tone={due.tone}>
                  {due.overdue ? <span className={styles.srOnly}>Overdue, due </span> : null}
                  {due.label}
                </span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <StatusIcon status={toUiStatus(task.status)} size={14} label={statusLabel(task.status)} />
            {tag ? (
              <span className={styles.mTag}>
                <span className={styles.mTagDot} style={{ background: accentVar(tag.color, 'dot') }} />
                <span className={styles.mTagName}>{tag.name}</span>
              </span>
            ) : null}
          </span>
        </span>
        <span role="cell" className={styles.mCell}>
          <PriorityIcon level={toUiPriority(task.priority)} />
        </span>
        {!hideAssignee && task.assignee ? (
          <span role="cell" className={styles.mCell}>
            <Avatar
              initials={task.assignee.initials}
              name={task.assignee.name}
              color={task.assignee.avatarColor}
              size={24}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
});
