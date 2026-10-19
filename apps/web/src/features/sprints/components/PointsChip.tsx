import styles from '../sprints.module.css';

/** Story points, always visible — keeps planning honest. */
export function PointsChip({ points }: { points: number | null }) {
  return (
    <span className={styles.points} title="Story points" aria-label={points === null ? 'Not estimated' : `${points} points`}>
      {points ?? '–'}
    </span>
  );
}
