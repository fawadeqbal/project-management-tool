import type { TimelineDto, TimelineLinkDto, TimelineRowDto } from '@hearth/contracts';
import { addDays, diffInDays, formatShortDate, parseDateOnly, toDateOnly } from '@hearth/domain';

export type Zoom = 'day' | 'week' | 'month' | 'quarter';

/** Pixels per day for each zoom (Week matches the design's 19px/day). */
export const PX_PER_DAY: Record<Zoom, number> = { day: 44, week: 19, month: 7, quarter: 2.5 };
export const ZOOM_OPTIONS: { id: Zoom; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
];
export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 48;

export interface Scale {
  from: Date;
  to: Date;
  px: number;
  days: number;
  width: number;
  /** x of the start of a calendar day. */
  x: (date: string | Date) => number;
  /** Calendar day under an x offset. */
  dateAt: (x: number) => string;
}

export function makeScale(from: string, to: string, zoom: Zoom): Scale {
  const f = parseDateOnly(from);
  const t = parseDateOnly(to);
  const px = PX_PER_DAY[zoom];
  const days = diffInDays(f, t) + 1;
  const x = (d: string | Date) => diffInDays(f, typeof d === 'string' ? parseDateOnly(d) : d) * px;
  return {
    from: f,
    to: t,
    px,
    days,
    width: days * px,
    x,
    dateAt: (xx: number) => toDateOnly(addDays(f, Math.floor(xx / px))),
  };
}

export interface HeaderCell {
  key: string;
  label: string;
  left: number;
  width: number;
  sub?: string;
}

/** Header cells: days (Day), weeks starting Sunday (Week), months (Month/Quarter). */
export function headerCells(scale: Scale, zoom: Zoom): HeaderCell[] {
  const cells: HeaderCell[] = [];
  if (zoom === 'day') {
    for (let i = 0; i < scale.days; i++) {
      const d = addDays(scale.from, i);
      cells.push({
        key: toDateOnly(d),
        label: String(d.getUTCDate()),
        sub: 'SMTWTFS'[d.getUTCDay()],
        left: i * scale.px,
        width: scale.px,
      });
    }
    return cells;
  }
  if (zoom === 'week') {
    let d = addDays(scale.from, -scale.from.getUTCDay());
    while (d.getTime() <= scale.to.getTime()) {
      const left = Math.max(0, scale.x(d));
      const end = Math.min(scale.width, scale.x(addDays(d, 7)));
      cells.push({ key: toDateOnly(d), label: formatShortDate(d), sub: 'SMTWTFS', left, width: end - left });
      d = addDays(d, 7);
    }
    return cells;
  }
  let d = new Date(Date.UTC(scale.from.getUTCFullYear(), scale.from.getUTCMonth(), 1));
  while (d.getTime() <= scale.to.getTime()) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const left = Math.max(0, scale.x(d));
    const end = Math.min(scale.width, scale.x(next));
    const label = d.toLocaleDateString('en-US', {
      month: zoom === 'quarter' ? 'short' : 'long',
      year: d.getUTCMonth() === 0 ? 'numeric' : undefined,
      timeZone: 'UTC',
    });
    cells.push({ key: toDateOnly(d), label, left, width: end - left });
    d = next;
  }
  return cells;
}

export interface BarGeometry {
  left: number;
  width: number;
}

/** A task bar spans start..due inclusive; at least 6px so a one-day task stays grabbable. */
export const barGeometry = (scale: Scale, start: string, due: string): BarGeometry => {
  const left = scale.x(start) + 1;
  return { left, width: Math.max(6, scale.x(due) + scale.px - left - 1) };
};

export const milestoneX = (scale: Scale, date: string) => scale.x(date) + scale.px / 2;

/** SVG path for a finish-to-start connector, in chart coordinates. */
export function linkPath(
  rows: readonly TimelineRowDto[],
  scale: Scale,
  link: TimelineLinkDto,
): string | null {
  const a = rows.findIndex((r) => r.id === link.fromId);
  const b = rows.findIndex((r) => r.id === link.toId);
  if (a < 0 || b < 0) return null;
  const from = rows[a]!;
  const to = rows[b]!;
  const xe =
    from.kind === 'task'
      ? barGeometry(scale, from.startDate, from.dueDate).left +
        barGeometry(scale, from.startDate, from.dueDate).width
      : from.kind === 'milestone'
        ? milestoneX(scale, from.date) + 7
        : null;
  const xs =
    to.kind === 'task'
      ? barGeometry(scale, to.startDate, to.dueDate).left
      : to.kind === 'milestone'
        ? milestoneX(scale, to.date) - 7
        : null;
  if (xe === null || xs === null) return null;
  const ye = a * ROW_HEIGHT + ROW_HEIGHT / 2;
  const ys = b * ROW_HEIGHT + ROW_HEIGHT / 2;
  const c = Math.max(16, Math.min(26, Math.abs(xs - xe) / 2 + 12));
  return `M${xe} ${ye} C ${xe + c} ${ye}, ${xs - c} ${ys}, ${xs - 2} ${ys}`;
}

/** Widen the server's window so the chart always fills the viewport at coarse zooms. */
export function chartRange(
  t: Pick<TimelineDto, 'from' | 'to'>,
  zoom: Zoom,
  minWidth = 900,
): { from: string; to: string } {
  const px = PX_PER_DAY[zoom];
  const days = diffInDays(parseDateOnly(t.from), parseDateOnly(t.to)) + 1;
  const need = Math.ceil(minWidth / px);
  if (days >= need) return { from: t.from, to: t.to };
  return { from: t.from, to: toDateOnly(addDays(parseDateOnly(t.from), need - 1)) };
}
