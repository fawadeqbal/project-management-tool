import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Button, SegmentedControl } from '@hearth/ui';
import type { ProjectRefDto, TaskDto } from '@hearth/contracts';
import { addDays, formatShortDate, parseDateOnly, toDateOnly } from '@hearth/domain';
import { todayIso } from '@/shared/tasks/dates';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { buildDays, RANGE_OPTIONS, rangeTitle, stepCursor, type CalendarRange } from '../calendar-model';
import { DayCell } from './DayCell';
import { TaskChip } from './TaskChip';
import { UnscheduledTray } from './UnscheduledTray';
import styles from '../calendar.module.css';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface TaskCalendarProps {
  /** Tasks with due dates in (or around) the visible range. */
  scheduled: readonly TaskDto[];
  /** Open tasks without a due date. */
  unscheduled: readonly TaskDto[];
  cursor: string;
  range: CalendarRange;
  onCursorChange: (cursor: string) => void;
  onRangeChange: (range: CalendarRange) => void;
  /** The view tabs (project or My tasks) rendered at the right of the toolbar. */
  tabs?: React.ReactNode;
  label: string;
}

const KEY_DELTA: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * Calendar (Calendar.dc.html): month grid Sun–Sat with chips, "+N more" popovers, an
 * unscheduled tray, drag to (re)schedule with Undo, and Day/Week views with the same chips.
 * Keyboard: arrows move day focus, Enter opens the day's popover, S on a tray item then Enter on a day schedules it.
 */
export function TaskCalendar({ scheduled, unscheduled, cursor, range, onCursorChange, onRangeChange, tabs, label }: TaskCalendarProps) {
  const today = todayIso();
  const { update } = useTaskMutations();
  const panel = useTaskPanel();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [focusDate, setFocusDate] = useState<string>(cursor);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const [dragging, setDragging] = useState<TaskDto | null>(null);
  const [picked, setPicked] = useState<TaskDto | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => buildDays(scheduled, cursor, range, today), [scheduled, cursor, range, today]);
  const legend = useMemo(() => {
    const map = new Map<string, ProjectRefDto>();
    for (const t of [...scheduled, ...unscheduled]) if (t.project) map.set(t.project.id, t.project);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [scheduled, unscheduled]);

  useEffect(() => {
    if (!days.some((d) => d.date === focusDate)) setFocusDate(days.find((d) => d.date === cursor)?.date ?? days[0]!.date);
  }, [days, focusDate, cursor]);

  const schedule = (task: TaskDto, dueDate: string | null) => {
    if (task.dueDate === dueDate) return;
    // Keep the start on or before the new due date.
    const patch = dueDate && task.startDate && task.startDate > dueDate ? { dueDate, startDate: dueDate } : { dueDate };
    const message = dueDate ? `${task.key} scheduled for ${formatShortDate(parseDateOnly(dueDate))}` : `${task.key} moved to Unscheduled`;
    void update(task, patch, { undoMessage: message });
  };

  const focusDay = (date: string) => {
    setFocusDate(date);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus());
  };

  const onDayKey = (date: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key in KEY_DELTA) {
      e.preventDefault();
      const next = toDateOnly(addDays(parseDateOnly(date), KEY_DELTA[e.key]!));
      if (!days.some((d) => d.date === next)) onCursorChange(next);
      focusDay(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (picked) {
        schedule(picked, date);
        setPicked(null);
      } else setPopoverDate(date);
    } else if (e.key === 'Escape' && picked) {
      setPicked(null);
    }
  };

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.task as TaskDto | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const task = e.active.data.current?.task as TaskDto | undefined;
    if (!task || !e.over) return;
    const date = e.over.data.current?.date as string | null | undefined;
    if (date === undefined) return;
    schedule(task, date);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title} aria-live="polite">
          {rangeTitle(cursor, range)}
        </h2>
        <Button variant="ghost" size="sm" icon="chevron-right" aria-label={`Previous ${range}`} className={styles.flip} onClick={() => onCursorChange(stepCursor(cursor, range, -1))} />
        <Button variant="ghost" size="sm" icon="chevron-right" aria-label={`Next ${range}`} onClick={() => onCursorChange(stepCursor(cursor, range, 1))} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onCursorChange(today);
            focusDay(today);
          }}
        >
          Today
        </Button>
        {picked ? (
          <span className={styles.pickHint} role="status">
            Choose a day for {picked.key} and press Enter · Esc to cancel
          </span>
        ) : null}
        <span className={styles.grow} />
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={(r) => onRangeChange(r as CalendarRange)} label="Range" />
        {tabs}
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className={styles.layout}>
          <div ref={gridRef} role="grid" aria-label={`${label}, ${rangeTitle(cursor, range)}`} className={styles.grid} data-range={range}>
            {range !== 'day' ? (
              <div role="row" className={styles.dow}>
                {DOW.map((d) => (
                  <div key={d} role="columnheader" className={styles.dowCell}>
                    {d}
                  </div>
                ))}
              </div>
            ) : null}
            <div className={styles.cells} data-range={range}>
              {chunk(days, range === 'day' ? 1 : 7).map((week) => (
                <div role="row" key={week[0]!.date} className={styles.week} data-range={range}>
                  {week.map((d) => (
                    <DayCell
                      key={d.date}
                      day={d}
                      expanded={range !== 'month'}
                      focused={focusDate === d.date}
                      popoverOpen={popoverDate === d.date}
                      onPopoverChange={(open) => setPopoverDate(open ? d.date : null)}
                      onFocusDay={() => setFocusDate(d.date)}
                      onKeyDown={onDayKey(d.date)}
                      onOpenTask={(t) => panel.open(t.key)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <UnscheduledTray
            tasks={unscheduled}
            legend={legend}
            picked={picked?.id ?? null}
            onOpen={(t) => panel.open(t.key)}
            onPick={(t) => {
              setPicked(t);
              focusDay(focusDate);
            }}
          />
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <TaskChip task={dragging} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

const chunk = <T,>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
