import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { TimelineConflictDto, TimelineTaskRowDto } from '@hearth/contracts';
import { Icon, Tooltip } from '@hearth/ui';
import { formatShortDate, parseDateOnly, STATUS_META } from '@hearth/domain';
import { barGeometry, type Scale } from '../timeline-scale';
import { applyDelta, type Draft, type DragMode } from './use-schedule-drafts';
import styles from '../timeline.module.css';

export interface TimelineBarProps {
  row: TimelineTaskRowDto;
  draft: Draft | undefined;
  scale: Scale;
  conflict: TimelineConflictDto | undefined;
  canEdit: boolean;
  onDraft: (draft: Draft | null) => void;
  onCommit: (draft: Draft) => void;
  onNudge: (mode: DragMode, days: number) => void;
  onOpen: () => void;
}

const human = (d: string) => formatShortDate(parseDateOnly(d));

/**
 * One Gantt bar: drag the body to move, either edge to resize (pointer), or focus it and use
 * ←/→ to move a day and Shift+←/→ to change the end date. Enter opens the task.
 */
export function TimelineBar({ row, draft, scale, conflict, canEdit, onDraft, onCommit, onNudge, onOpen }: TimelineBarProps) {
  const drag = useRef<{ mode: DragMode; x: number; moved: boolean } | null>(null);
  const dates = draft ?? row;
  const geo = barGeometry(scale, dates.startDate, dates.dueDate);
  const done = row.status === 'DONE';
  const tone = row.critical && !done ? 'critical' : done ? 'done' : 'normal';
  const showLabel = geo.width >= 90;
  const baseline = row.baselineStart && row.baselineDue ? barGeometry(scale, row.baselineStart, row.baselineDue) : null;

  const begin = (mode: DragMode) => (e: PointerEvent<HTMLElement>) => {
    if (!canEdit || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, x: e.clientX, moved: false };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const days = Math.round((e.clientX - d.x) / scale.px);
    if (days !== 0) d.moved = true;
    if (d.moved) onDraft(applyDelta(row, d.mode, days));
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) return onOpen();
    onCommit(applyDelta(row, d.mode, Math.round((e.clientX - d.x) / scale.px)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      return onOpen();
    }
    if (!canEdit || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    e.stopPropagation();
    onNudge(e.shiftKey ? 'end' : 'move', e.key === 'ArrowLeft' ? -1 : 1);
  };

  return (
    <>
      {baseline ? <div className={styles.baseline} style={{ left: baseline.left - 1, width: baseline.width + 2 }} aria-hidden="true" /> : null}
      <div
        role="button"
        tabIndex={0}
        data-bar-id={row.id}
        data-tone={tone}
        data-dragging={draft ? 'true' : undefined}
        aria-roledescription="Timeline bar"
        aria-label={`${row.key} ${row.title}, ${STATUS_META[row.status].label}, ${human(dates.startDate)} to ${human(dates.dueDate)}${row.critical ? ', on the critical path' : ''}.${canEdit ? ' Arrow keys move a day, Shift+arrows change the end date.' : ''} Enter opens.`}
        className={styles.bar}
        style={{ left: geo.left, width: geo.width }}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => (drag.current = null, onDraft(null))}
        onKeyDown={onKeyDown}
      >
        {tone === 'critical' ? <span className={styles.progress} style={{ width: `${row.progress}%` }} /> : null}
        {showLabel ? <span className={styles.barLabel}>{row.title}</span> : null}
        {canEdit ? (
          <>
            <span className={styles.handle} data-edge="start" onPointerDown={begin('start')} onPointerMove={move} onPointerUp={end} aria-hidden="true" />
            <span className={styles.handle} data-edge="end" onPointerDown={begin('end')} onPointerMove={move} onPointerUp={end} aria-hidden="true" />
          </>
        ) : null}
      </div>
      {conflict ? (
        <Tooltip content={`Starts ${conflict.overlapDays} ${conflict.overlapDays === 1 ? 'day' : 'days'} before ${conflict.blockerKey ?? 'its blocker'} finishes`}>
          <span
            tabIndex={0}
            role="img"
            aria-label={`Dependency conflict: starts before ${conflict.blockerKey ?? 'its blocker'} finishes`}
            className={styles.conflict}
            style={{ left: geo.left - 24 }}
          >
            <Icon name="alert" size={12} />
          </span>
        </Tooltip>
      ) : null}
    </>
  );
}
