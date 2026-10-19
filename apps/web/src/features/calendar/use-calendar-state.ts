import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { todayIso } from '@/shared/tasks/dates';
import { rangeWindow, type CalendarRange } from './calendar-model';

/** Cursor and range live in the URL (?date=2026-10-19&range=week) so views are linkable. */
export function useCalendarState() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('date');
  const cursor = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayIso();
  const r = params.get('range');
  const range: CalendarRange = r === 'day' || r === 'week' ? r : 'month';
  const set = useCallback(
    (key: 'date' | 'range', value: string) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set(key, value);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const window = useMemo(() => rangeWindow(cursor, range), [cursor, range]);
  return {
    cursor,
    range,
    window,
    setCursor: (d: string) => set('date', d),
    setRange: (v: CalendarRange) => set('range', v),
  };
}
