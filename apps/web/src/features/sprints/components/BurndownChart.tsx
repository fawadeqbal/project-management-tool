import { useId } from 'react';
import type { BurndownDto } from '@hearth/contracts';
import { FRAME, burndownGeometry, paceLabel } from '../lib/burndown-geometry';
import styles from '../sprints.module.css';

/** "Are we on pace?" — ideal dashed, actual solid, scope changes and today marked. */
export function BurndownChart({ burndown }: { burndown: BurndownDto }) {
  const g = burndownGeometry(burndown);
  const pace = paceLabel(burndown);
  const titleId = useId();
  const descId = useId();
  return (
    <section aria-label="Burndown" className={styles.card}>
      <div className={styles.cardHead}>
        <strong className={styles.cardTitle}>Are we on pace?</strong>
        <span className={styles[`pace_${pace.tone}`]}>{pace.text}</span>
      </div>
      <svg role="img" aria-labelledby={`${titleId} ${descId}`} width="100%" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} className={styles.chart}>
        <title id={titleId}>Sprint burndown</title>
        <desc id={descId}>{g.description}</desc>
        {g.grid.map((line) => (
          <g key={line.value}>
            <line x1={FRAME.x0} x2={FRAME.x1} y1={line.y} y2={line.y} className={styles.gridLine} />
            <text x={24} y={line.y + 3} textAnchor="end" className={styles.axisText}>
              {line.value}
            </text>
          </g>
        ))}
        {g.todayX !== null ? <line data-testid="burndown-today" x1={g.todayX} x2={g.todayX} y1={FRAME.y1} y2={FRAME.y0} className={styles.todayLine} /> : null}
        <polyline data-testid="burndown-ideal" points={g.idealPath} className={styles.idealLine} />
        {g.actualPath ? <polyline data-testid="burndown-actual" points={g.actualPath} className={styles.actualLine} /> : null}
        {g.scope.map((s) => (
          <g key={`${s.x}-${s.y}`} data-testid="burndown-scope">
            <circle cx={s.x} cy={s.y} r={4} className={styles.scopeDot} />
            <text x={s.x + 8} y={s.y - 8} className={styles.scopeText}>
              {s.label}
            </text>
          </g>
        ))}
        {g.xLabels.map((l) => (
          <text key={l.x} x={l.x} y={210} textAnchor="middle" className={styles.axisText}>
            {l.label}
          </text>
        ))}
      </svg>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.legendActual} />
          Remaining
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendIdeal} />
          Ideal
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendScope} />
          Scope change
        </span>
      </div>
    </section>
  );
}
