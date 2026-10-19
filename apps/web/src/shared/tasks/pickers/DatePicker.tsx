import { useMemo, useState, type KeyboardEvent } from 'react';
import { Button } from '@hearth/ui';
import { addDays, parseDateOnly, toDateOnly } from '@hearth/domain';
import { today as todayDate } from '../dates';
import { PropertyPopover, type PropertyPopoverProps } from './PropertyPopover';
import styles from './pickers.module.css';

export interface DatePickerProps extends Omit<PropertyPopoverProps, 'label' | 'children'> {
  /** "YYYY-MM-DD" or null. */
  value: string | null;
  onChange: (date: string | null) => void;
  label?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const monthTitle = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Monday-first grid of 6 weeks covering the month of `cursor`. */
const monthGrid = (cursor: Date): Date[] => {
  const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

const nextMonday = (t: Date) => addDays(t, (1 - t.getUTCDay() + 7) % 7 || 7);

/** Small calendar with Today / Tomorrow / Next week shortcuts and Clear. Arrow keys move by day/week. */
export function DatePicker({
  value,
  onChange,
  onOpenChange,
  label = 'Pick a date',
  ...popover
}: DatePickerProps) {
  const t = todayDate();
  const selected = value ? parseDateOnly(value) : null;
  const [cursor, setCursor] = useState<Date>(selected ?? t);
  const [focusDay, setFocusDay] = useState<Date>(selected ?? t);
  const days = useMemo(() => monthGrid(cursor), [cursor]);

  const pick = (d: Date | null) => {
    onOpenChange(false);
    onChange(d ? toDateOnly(d) : null);
  };

  const moveFocus = (delta: number) => {
    const next = addDays(focusDay, delta);
    setFocusDay(next);
    if (next.getUTCMonth() !== cursor.getUTCMonth()) setCursor(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-date="${toDateOnly(next)}"]`)?.focus(),
    );
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(map[e.key]!);
    }
  };

  const shiftMonth = (delta: number) =>
    setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + delta, 1)));

  return (
    <PropertyPopover {...popover} onOpenChange={onOpenChange} label={label}>
      <div className={styles.calendar}>
        <div className={styles.shortcuts}>
          <Button size="sm" variant="secondary" onClick={() => pick(t)}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={() => pick(addDays(t, 1))}>
            Tomorrow
          </Button>
          <Button size="sm" variant="secondary" onClick={() => pick(nextMonday(t))}>
            Next week
          </Button>
        </div>
        <div className={styles.calHeader}>
          <Button
            size="sm"
            variant="ghost"
            icon="chevron-right"
            aria-label="Previous month"
            style={{ transform: 'scaleX(-1)' }}
            onClick={() => shiftMonth(-1)}
          />
          <span aria-live="polite">{monthTitle(cursor)}</span>
          <Button
            size="sm"
            variant="ghost"
            icon="chevron-right"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          />
        </div>
        <div className={styles.grid} role="grid" aria-label={monthTitle(cursor)} onKeyDown={onGridKey}>
          {WEEKDAYS.map((w) => (
            <span key={w} className={styles.weekday} role="columnheader">
              {w}
            </span>
          ))}
          {days.map((d) => {
            const iso = toDateOnly(d);
            const isSelected = !!selected && toDateOnly(selected) === iso;
            const isFocus = toDateOnly(focusDay) === iso;
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                data-date={iso}
                className={styles.day}
                data-outside={d.getUTCMonth() !== cursor.getUTCMonth()}
                data-today={iso === toDateOnly(t)}
                aria-selected={isSelected}
                aria-label={d.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
                tabIndex={isFocus ? 0 : -1}
                onClick={() => pick(d)}
              >
                {d.getUTCDate()}
              </button>
            );
          })}
        </div>
        <div className={styles.calFooter}>
          <Button size="sm" variant="ghost" onClick={() => pick(null)} disabled={!value}>
            Clear
          </Button>
        </div>
      </div>
    </PropertyPopover>
  );
}
