import type { DashboardDto } from '@hearth/contracts';
import { StatusIcon, toUiStatus } from '@hearth/ui';
import styles from '../dashboard.module.css';

const COLOR: Record<string, string> = {
  TODO: 'var(--status-todo)',
  IN_PROGRESS: 'var(--status-progress)',
  IN_REVIEW: 'var(--status-review)',
  BLOCKED: 'var(--status-blocked)',
};

/** "Where is work right now?" — open work by status as a labeled stacked bar. */
export function StatusMixCard({
  mix,
  blockedNote,
}: {
  mix: DashboardDto['statusMix'];
  blockedNote: string | null;
}) {
  const total = mix.reduce((a, s) => a + s.count, 0);
  const label = `Open work by status: ${mix.map((s) => `${s.label} ${s.count}`).join(', ')}`;
  return (
    <section aria-labelledby="status-mix-h" className={`${styles.card} ${styles.statusMix}`}>
      <h2 id="status-mix-h" className={styles.cardTitle}>
        Where is work right now?
      </h2>
      {total === 0 ? (
        <p className={styles.muted}>No open work — everything in range is done.</p>
      ) : (
        <>
          <div role="img" aria-label={label} className={styles.stack}>
            {mix
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.status}
                  style={{ flex: `${s.count} 1 0`, background: COLOR[s.status] }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
          </div>
          <ul className={styles.mixList}>
            {mix.map((s) => (
              <li key={s.status}>
                <StatusIcon status={toUiStatus(s.status)} />
                <span className={styles.grow}>{s.label}</span>
                <strong>{s.count}</strong>
                <span className={styles.pct}>{s.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {blockedNote ? (
        <p className={styles.blockedNote} role="note">
          {blockedNote}
        </p>
      ) : null}
    </section>
  );
}
