import styles from '../workload.module.css';

const ITEMS = [
  { state: 'light', label: 'Under 50%' },
  { state: 'normal', label: '50–87%' },
  { state: 'full', label: 'Full' },
  { state: 'over', label: 'Over capacity' },
  { state: 'off', label: 'Time off' },
] as const;

export function WorkloadLegend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {ITEMS.map((i) => (
        <li key={i.state} className={styles.legendItem}>
          <span className={styles.swatch} data-state={i.state} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
