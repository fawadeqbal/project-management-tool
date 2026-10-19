import { Icon } from '@hearth/ui';
import type { HealthMetaDto } from '@hearth/contracts';
import { asIcon } from '@/shared/tasks/meta';
import styles from '../projects.module.css';

/** Health is always icon + label + color (WCAG 1.4.1). `detail` adds "· pricing slipped 2 days". */
export function HealthBadge({ health, detail }: { health: HealthMetaDto; detail?: string | null }) {
  return (
    <span className={styles.health} data-tone={health.tone}>
      <Icon name={asIcon(health.icon, 'alert')} className={styles.healthIcon} />
      {health.label}
      {detail ? <span className={styles.healthDetail}> · {detail}</span> : null}
    </span>
  );
}
