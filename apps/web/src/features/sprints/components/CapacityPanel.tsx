import { Icon } from '@hearth/ui';
import type { SprintDetailDto } from '@hearth/contracts';
import styles from '../sprints.module.css';

/** Commitment vs. velocity: warns before the team over-commits (error prevention). */
export function CapacityPanel({
  capacity,
  velocity,
}: {
  capacity: SprintDetailDto['capacity'];
  velocity: SprintDetailDto['velocity'];
}) {
  const max = Math.max(capacity.committed, capacity.velocity, 1);
  const fill = Math.min(100, (capacity.committed / max) * 100);
  const marker = capacity.velocity ? (capacity.velocity / max) * 100 : null;
  const tallest = Math.max(1, ...velocity.bars.map((b) => b.points));
  const warn = capacity.level === 'over';
  return (
    <section aria-label="Capacity" className={styles.card}>
      <div className={styles.cardHead}>
        <strong className={styles.cardTitle}>Commitment vs. velocity</strong>
        <span className={styles.muted}>
          {capacity.committed} / {capacity.velocity} pts
        </span>
      </div>
      <div
        className={styles.capTrack}
        role="meter"
        aria-label="Committed points against average velocity"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={capacity.committed}
        aria-valuetext={`${capacity.committed} of ${capacity.velocity} points`}
      >
        <div
          className={
            warn ? styles.capFillOver : capacity.level === 'near' ? styles.capFillNear : styles.capFill
          }
          style={{ width: `${fill}%` }}
        />
        {marker !== null ? (
          <div
            className={styles.capMarker}
            style={{ left: `${marker}%` }}
            title={`Average velocity: ${capacity.velocity} points`}
          />
        ) : null}
      </div>
      <p className={warn ? styles.capMessageWarn : styles.capMessage}>
        {warn ? <Icon name="alert" size={14} className={styles.warnIcon} /> : null}
        {capacity.message}
      </p>
      <div className={styles.velocity} role="list" aria-label="Velocity by sprint">
        {velocity.bars.map((b) => (
          <div
            key={b.sprintId}
            className={styles.velocityCol}
            role="listitem"
            aria-label={`${b.label}: ${b.points} points${b.isPlan ? ' planned' : ' completed'}`}
          >
            <span className={styles.velocityValue}>
              {b.points}
              {b.isPlan ? ' (plan)' : ''}
            </span>
            <div
              className={
                b.isPlan ? (warn ? styles.velocityBarOver : styles.velocityBarPlan) : styles.velocityBar
              }
              style={{ height: `${Math.max(4, Math.round((b.points / tallest) * 48))}px` }}
            />
            <span className={styles.velocityLabel}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
