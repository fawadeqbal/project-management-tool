import type { BurndownDto } from '@hearth/contracts';
import { formatShortDate, parseDateOnly } from '@hearth/domain';

/** Chart frame from the design: 400×220 viewBox, plot area x 32–392, y 12–192. */
export const FRAME = { width: 400, height: 220, x0: 32, x1: 392, y0: 192, y1: 12 } as const;

const niceMax = (n: number) => Math.max(10, Math.ceil((n * 1.15) / 10) * 10);

export interface BurndownGeometry {
  max: number;
  x: (day: number) => number;
  y: (points: number) => number;
  idealPath: string;
  actualPath: string;
  grid: { value: number; y: number }[];
  xLabels: { x: number; label: string }[];
  todayX: number | null;
  scope: { x: number; y: number; label: string }[];
  description: string;
}

/** Pure geometry for the burndown SVG, so the chart component only draws. */
export const burndownGeometry = (b: BurndownDto): BurndownGeometry => {
  const max = niceMax(b.maxPoints);
  const days = Math.max(1, b.totalDays);
  const x = (d: number) => FRAME.x0 + (d / days) * (FRAME.x1 - FRAME.x0);
  const y = (v: number) => FRAME.y0 - (v / max) * (FRAME.y0 - FRAME.y1);
  const path = (pts: { day: number; remaining: number }[]) =>
    pts.map((p) => `${x(p.day).toFixed(1)},${y(p.remaining).toFixed(1)}`).join(' ');
  const step = max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  const grid = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => ({
    value: i * step,
    y: y(i * step),
  }));
  const labelEvery = Math.max(1, Math.round(days / 5));
  const lastIndex = b.days.length - 1;
  const ticks = b.days
    .map((_, i) => i)
    .filter((i) => i % labelEvery === 0 && lastIndex - i >= labelEvery / 2);
  if (lastIndex > 0) ticks.push(lastIndex);
  const xLabels = ticks.map((i) => ({ x: x(i), label: formatShortDate(parseDateOnly(b.days[i]!)) }));
  const last = b.actual[b.actual.length - 1];
  const idealToday = last ? b.ideal[last.day]?.remaining : undefined;
  const scopeText = b.scopeChanges
    .map((c) => `${c.addedPoints} points of scope added on day ${c.day}`)
    .join('; ');
  const description = last
    ? `Burndown: ${last.remaining} points remaining on day ${last.day} of ${days}, ideal is ${idealToday ?? 0}${scopeText ? `; ${scopeText}` : ''}.`
    : `Burndown: no progress recorded yet; ${b.ideal[0]?.remaining ?? 0} points planned over ${days} days.`;
  return {
    max,
    x,
    y,
    idealPath: path(b.ideal.length ? [b.ideal[0]!, b.ideal[b.ideal.length - 1]!] : []),
    actualPath: path(b.actual),
    grid,
    xLabels,
    todayX: b.todayIndex === null ? null : x(b.todayIndex),
    scope: b.scopeChanges.map((c) => ({
      x: x(c.day),
      y: y(c.remaining),
      label: `+${c.addedPoints} pts scope`,
    })),
    description,
  };
};

/** "9 pts behind ideal" / "On pace" / "3 pts ahead" */
export const paceLabel = (b: BurndownDto): { text: string; tone: 'warning' | 'success' | 'neutral' } => {
  if (!b.actual.length) return { text: 'Not started yet', tone: 'neutral' };
  const n = Math.round(Math.abs(b.behindBy));
  if (b.behindBy > 0.5) return { text: `${n} ${n === 1 ? 'pt' : 'pts'} behind ideal`, tone: 'warning' };
  if (b.behindBy < -0.5) return { text: `${n} ${n === 1 ? 'pt' : 'pts'} ahead of ideal`, tone: 'success' };
  return { text: 'On pace', tone: 'success' };
};
