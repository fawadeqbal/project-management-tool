import { useMemo } from 'react';
import type { TimelineDto, TimelineRowDto, TimelineTaskRowDto } from '@hearth/contracts';
import { formatShortDate, parseDateOnly } from '@hearth/domain';
import {
  headerCells,
  HEADER_HEIGHT,
  linkPath,
  milestoneX,
  ROW_HEIGHT,
  type Scale,
  type Zoom,
} from '../timeline-scale';
import { TimelineBar } from './TimelineBar';
import type { Draft, DragMode } from './use-schedule-drafts';
import styles from '../timeline.module.css';

export interface TimelineChartProps {
  timeline: TimelineDto;
  rows: TimelineRowDto[];
  scale: Scale;
  zoom: Zoom;
  drafts: Record<string, Draft>;
  canEdit: boolean;
  onDraft: (row: TimelineTaskRowDto, draft: Draft | null) => void;
  onCommit: (row: TimelineTaskRowDto, draft: Draft) => void;
  onNudge: (row: TimelineTaskRowDto, mode: DragMode, days: number) => void;
  onOpen: (row: TimelineTaskRowDto) => void;
}

/** Right side of the Gantt: header, weekend shading, bars, baselines, milestones, connectors, Today. */
export function TimelineChart({
  timeline,
  rows,
  scale,
  zoom,
  drafts,
  canEdit,
  onDraft,
  onCommit,
  onNudge,
  onOpen,
}: TimelineChartProps) {
  const cells = useMemo(() => headerCells(scale, zoom), [scale, zoom]);
  const conflictFor = useMemo(
    () => new Map(timeline.conflicts.map((c) => [c.taskId, c])),
    [timeline.conflicts],
  );
  // Connectors follow drafts so dependents visibly stay attached while dragging.
  const drawnRows = useMemo(
    () => rows.map((r) => (r.kind === 'task' && drafts[r.id] ? { ...r, ...drafts[r.id] } : r)),
    [rows, drafts],
  );
  const links = useMemo(
    () =>
      timeline.links
        .map((l) => ({ ...l, d: linkPath(drawnRows, scale, l) }))
        .filter((l): l is typeof l & { d: string } => !!l.d),
    [timeline.links, drawnRows, scale],
  );
  const height = rows.length * ROW_HEIGHT;
  const todayX = scale.x(timeline.today) + scale.px / 2 - 1;
  const showToday = todayX >= 0 && todayX <= scale.width;
  // Weekend tint (Sat/Sun columns) only where a day is wide enough to read.
  const sat = (6 - scale.from.getUTCDay() + 7) % 7;
  const weekendBg =
    scale.px >= 6
      ? `repeating-linear-gradient(90deg, transparent 0, transparent ${sat * scale.px}px, var(--bg-subtle) ${sat * scale.px}px, var(--bg-subtle) ${(sat + 2) * scale.px}px, transparent ${(sat + 2) * scale.px}px, transparent ${(sat + 7) * scale.px}px)`
      : undefined;

  return (
    <div className={styles.chartScroll} data-testid="timeline-chart">
      <div className={styles.chart} style={{ width: scale.width }} data-zoom={zoom} data-px={scale.px}>
        <div className={styles.chartHeader} style={{ height: HEADER_HEIGHT }}>
          {cells.map((c) => (
            <div key={c.key} className={styles.headerCell} style={{ left: c.left, width: c.width }}>
              <span className={styles.headerLabel}>{c.label}</span>
              {c.sub ? (
                <span
                  className={styles.headerSub}
                  style={zoom === 'week' ? { letterSpacing: `${Math.max(0, scale.px - 6.2)}px` } : undefined}
                >
                  {c.sub}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div
          className={styles.chartBody}
          style={{ height, backgroundImage: weekendBg, backgroundPositionX: 0 }}
        >
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={styles.chartRow}
              data-kind={r.kind}
              style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              {r.kind === 'task' ? (
                <TimelineBar
                  row={r}
                  draft={drafts[r.id]}
                  scale={scale}
                  conflict={conflictFor.get(r.id)}
                  canEdit={canEdit}
                  onDraft={(d) => onDraft(r, d)}
                  onCommit={(d) => onCommit(r, d)}
                  onNudge={(mode, days) => onNudge(r, mode, days)}
                  onOpen={() => onOpen(r)}
                />
              ) : r.kind === 'milestone' ? (
                <>
                  <span
                    className={styles.milestone}
                    data-done={r.done || undefined}
                    style={{ left: milestoneX(scale, r.date) - 7 }}
                    aria-hidden="true"
                  />
                  <span className={styles.milestoneLabel} style={{ left: milestoneX(scale, r.date) + 14 }}>
                    {r.name} · {formatShortDate(parseDateOnly(r.date))}
                  </span>
                </>
              ) : null}
            </div>
          ))}
          <svg aria-hidden="true" width={scale.width} height={height} className={styles.links}>
            <defs>
              <marker
                id="tl-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 z" className={styles.arrow} />
              </marker>
              <marker
                id="tl-arrow-critical"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 z" className={styles.arrowCritical} />
              </marker>
            </defs>
            {links.map((l) => (
              <path
                key={`${l.fromId}-${l.toId}`}
                d={l.d}
                data-critical={l.critical || undefined}
                className={styles.link}
                markerEnd={`url(#${l.critical ? 'tl-arrow-critical' : 'tl-arrow'})`}
              />
            ))}
          </svg>
          {showToday ? (
            <>
              <div
                className={styles.todayLine}
                style={{ left: todayX, top: -HEADER_HEIGHT }}
                aria-hidden="true"
              />
              <span className={styles.todayLabel} style={{ left: todayX + 5, top: -HEADER_HEIGHT + 2 }}>
                Today
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
