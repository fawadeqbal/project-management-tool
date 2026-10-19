import { ROLE_META, ROLES } from '@hearth/domain';
import styles from '../settings.module.css';

/** "What each role can do" — plain words, next to the members list. */
export function RolesCard({ onOpenMatrix }: { onOpenMatrix: () => void }) {
  return (
    <section aria-labelledby="roles-card" className={styles.card}>
      <h2 id="roles-card" className={styles.cardTitle}>
        What each role can do
      </h2>
      <dl className={styles.roleList}>
        {ROLES.map((r) => (
          <div key={r} className={styles.roleItem}>
            <dt>{ROLE_META[r].label}</dt>
            <dd>{ROLE_META[r].description}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={styles.linkStrong} onClick={onOpenMatrix}>
        View permission matrix →
      </button>
    </section>
  );
}
