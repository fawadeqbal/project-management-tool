import type { UsageMeterDto } from '@hearth/contracts';
import { Icon, isIconName } from '@hearth/ui';
import styles from '../billing.module.css';

/** Seats, storage, automation runs and AI credits — limits visible before they're hit. */
export function UsageMeters({ usage }: { usage: UsageMeterDto[] }) {
  return (
    <section aria-label="Usage" className={styles.usage}>
      {usage.map((u) => (
        <div key={u.meter} className={styles.meter}>
          <span className={styles.meterLabel}>
            {isIconName(u.icon) ? <Icon name={u.icon} /> : null}
            {u.label}
          </span>
          <span className={styles.meterValue}>
            {u.usedLabel} <span className={styles.meterMax}>/ {u.limitLabel}</span>
          </span>
          <div
            className={styles.meterTrack}
            role="progressbar"
            aria-label={`${u.label} used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={u.pct}
            aria-valuetext={`${u.usedLabel} of ${u.limitLabel}`}
          >
            <div
              className={`${styles.meterFill} ${u.warning ? styles.meterFillWarning : ''}`}
              style={{ width: `${u.pct}%` }}
            />
          </div>
          <span className={`${styles.meterNote} ${u.warning ? styles.meterNoteWarning : ''}`}>
            {u.warning ? <Icon name="alert" size={12} label="Warning" /> : null}
            {u.note}
          </span>
        </div>
      ))}
    </section>
  );
}
