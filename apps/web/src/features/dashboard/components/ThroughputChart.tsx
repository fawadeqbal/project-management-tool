import { useId, useState } from 'react';
import type { DashboardDto } from '@hearth/contracts';
import { VisuallyHidden } from '@hearth/ui';
import styles from '../dashboard.module.css';

const W = 560;
const H = 220;
const LEFT = 36;
const RIGHT = 8;
const TOP = 16;
const BASE = 196;

/** Rounded top, square bottom: the data end is rounded, the baseline end is anchored. */
const barPath = (x: number, y: number, w: number, h: number, r = 4) => {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${BASE} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${BASE} Z`;
};

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * step).find((u) => Math.ceil(v / u) <= 4) ?? step * 10;
  return Math.ceil(v / unit) * unit;
};

/** "Are we finishing what we start?" — created vs completed per week, series labeled directly. */
export function ThroughputChart({
  data,
}: {
  data: Pick<DashboardDto, 'throughput' | 'throughputVerdict' | 'rangeLabel'>;
}) {
  const titleId = useId();
  const descId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const weeks = data.throughput;
  const max = niceMax(Math.max(1, ...weeks.flatMap((w) => [w.created, w.completed])));
  const Y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const slot = (W - LEFT - RIGHT) / Math.max(1, weeks.length);
  const barW = Math.max(6, Math.min(26, slot / 2 - 6));
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const showValues = weeks.length <= 8;
  const last = weeks.length - 1;
  const desc =
    `${data.throughputVerdict.text}, ${data.rangeLabel}. ` +
    weeks.map((w) => `Week of ${w.label}: ${w.created} created, ${w.completed} completed`).join('; ') +
    '.';

  return (
    <section aria-labelledby={`${titleId}-h`} className={`${styles.card} ${styles.throughput}`}>
      <div className={styles.cardHead}>
        <h2 id={`${titleId}-h`} className={styles.cardTitle}>
          Are we finishing what we start?
        </h2>
        <span className={data.throughputVerdict.tone === 'good' ? styles.verdictGood : styles.verdictBad}>
          {data.throughputVerdict.text}
        </span>
      </div>
      <div className={styles.chartWrap}>
        <svg
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className={styles.chart}
          onMouseLeave={() => setHover(null)}
        >
          <title id={titleId}>Tasks created versus completed per week</title>
          <desc id={descId}>{desc}</desc>
          {grid.map((v) => (
            <g key={v} aria-hidden="true">
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={Y(v)}
                y2={Y(v)}
                className={v === 0 ? styles.baseline : styles.gridline}
              />
              <text x={LEFT - 8} y={Y(v) + 3} textAnchor="end" className={styles.axisText}>
                {v}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const xc = LEFT + slot * i + slot / 2;
            const x1 = xc - barW - 1;
            const x2 = xc + 1;
            const active = hover === i;
            return (
              <g
                key={w.weekStart}
                aria-hidden="true"
                onMouseEnter={() => setHover(i)}
                className={hover !== null && !active ? styles.dimmed : undefined}
              >
                <rect x={xc - slot / 2} y={TOP} width={slot} height={BASE - TOP} className={styles.hit} />
                <path
                  d={barPath(x1, Y(w.created), barW, BASE - Y(w.created))}
                  className={styles.barCreated}
                />
                <path
                  d={barPath(x2, Y(w.completed), barW, BASE - Y(w.completed))}
                  className={styles.barCompleted}
                />
                {showValues || active ? (
                  <>
                    <text
                      x={x1 + barW / 2}
                      y={Y(w.created) - 4}
                      textAnchor="middle"
                      className={styles.valueTextMuted}
                    >
                      {w.created}
                    </text>
                    <text
                      x={x2 + barW / 2}
                      y={Y(w.completed) - 4}
                      textAnchor="middle"
                      className={styles.valueText}
                    >
                      {w.completed}
                    </text>
                  </>
                ) : null}
                <text x={xc} y={212} textAnchor="middle" className={styles.axisText}>
                  {weeks.length > 8 && i % 2 === 1 && i !== last ? '' : w.label}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && weeks[hover] ? (
          <div
            className={styles.tooltip}
            role="presentation"
            style={{ left: `${((LEFT + slot * hover + slot / 2) / W) * 100}%` }}
          >
            <strong>Week of {weeks[hover].label}</strong>
            <span>
              <i className={styles.swatchCreated} /> Created {weeks[hover].created}
            </span>
            <span>
              <i className={styles.swatchCompleted} /> Completed {weeks[hover].completed}
            </span>
          </div>
        ) : null}
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.swatchCreated} />
          Created
        </span>
        <span>
          <i className={styles.swatchCompleted} />
          Completed
        </span>
      </div>
      <VisuallyHidden>
        <table>
          <caption>Tasks created and completed per week</caption>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">Created</th>
              <th scope="col">Completed</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart}>
                <th scope="row">{w.label}</th>
                <td>{w.created}</td>
                <td>{w.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </section>
  );
}
