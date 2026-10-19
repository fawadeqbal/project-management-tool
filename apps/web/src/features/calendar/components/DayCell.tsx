import { useRef, type KeyboardEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Popover } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { longDate, MAX_CHIPS, type CalendarDay } from '../calendar-model';
import { TaskChip } from './TaskChip';
import styles from '../calendar.module.css';

export interface DayCellProps {
  day: CalendarDay;
  /** Show every chip (Day/Week views have room); Month collapses to +N more. */
  expanded?: boolean;
  focused: boolean;
  popoverOpen: boolean;
  onPopoverChange: (open: boolean) => void;
  onFocusDay: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onOpenTask: (task: TaskDto) => void;
}

/** One day: number (today is the only filled marker), up to 3 chips, then "+N more" → popover. */
export function DayCell({ day, expanded = false, focused, popoverOpen, onPopoverChange, onFocusDay, onKeyDown, onOpenTask }: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.date}`, data: { date: day.date } });
  const moreRef = useRef<HTMLButtonElement>(null);
  const cellRef = useRef<HTMLDivElement | null>(null);
  const shown = expanded ? day.tasks : day.tasks.slice(0, MAX_CHIPS);
  const hidden = day.tasks.length - shown.length;
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        cellRef.current = el;
      }}
      role="gridcell"
      tabIndex={focused ? 0 : -1}
      data-date={day.date}
      aria-label={`${longDate(day.date)}${day.isToday ? ', today' : ''}, ${day.tasks.length ? `${day.tasks.length} ${day.tasks.length === 1 ? 'task' : 'tasks'}` : 'no tasks'}`}
      aria-selected={focused}
      className={styles.day}
      data-out={!day.inMonth || undefined}
      data-weekend={day.weekend || undefined}
      data-over={isOver || undefined}
      data-expanded={expanded || undefined}
      onFocus={(e) => e.target === e.currentTarget && onFocusDay()}
      onKeyDown={onKeyDown}
    >
      <span className={styles.dayNumber} data-today={day.isToday || undefined} aria-hidden="true">
        {day.day}
      </span>
      {shown.map((t) => (
        <TaskChip key={t.id} task={t} onOpen={onOpenTask} />
      ))}
      {hidden > 0 ? (
        <button ref={moreRef} type="button" className={styles.more} aria-haspopup="dialog" aria-expanded={popoverOpen} onClick={() => onPopoverChange(!popoverOpen)}>
          +{hidden} more
        </button>
      ) : null}
      {popoverOpen ? (
        <Popover open onOpenChange={onPopoverChange} anchorRef={hidden > 0 ? moreRef : cellRef} aria-label={`Tasks due ${longDate(day.date)}`}>
          <div className={styles.dayPopover}>
            <div className={styles.popoverTitle}>{longDate(day.date)}</div>
            {day.tasks.length ? (
              day.tasks.map((t) => <TaskChip key={t.id} task={t} onOpen={onOpenTask} draggable={false} />)
            ) : (
              <p className={styles.muted}>Nothing due. Drag a task here to schedule it.</p>
            )}
          </div>
        </Popover>
      ) : null}
    </div>
  );
}
