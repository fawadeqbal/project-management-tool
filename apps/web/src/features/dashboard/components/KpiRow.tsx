import type { KpiDto } from '@hearth/contracts';
import { Icon, KpiTile, type KpiTone } from '@hearth/ui';
import styles from '../dashboard.module.css';

const TONE: Record<KpiDto['deltaTone'], KpiTone> = { good: 'success', bad: 'danger', neutral: 'neutral' };
const TONE_WORD: Record<KpiDto['deltaTone'], string> = { good: 'better', bad: 'worse', neutral: 'no change' };

/** The number, the change (icon + label + color, never color alone) and what "good" means. */
export function KpiRow({ kpis }: { kpis: KpiDto[] }) {
  return (
    <section aria-label="Key numbers" className={styles.kpis}>
      {kpis.map((k) => (
        <KpiTile
          key={k.label}
          label={k.label}
          value={k.value}
          data-tone={k.deltaTone}
          deltaTone={TONE[k.deltaTone]}
          delta={
            <span className={styles.delta}>
              <Icon name={k.deltaTone === 'good' ? 'check' : k.deltaTone === 'bad' ? 'alert' : 'clock'} size={12} />
              {k.delta}
              <span className={styles.srOnly}> ({TONE_WORD[k.deltaTone]})</span>
            </span>
          }
          sub={k.sub}
        />
      ))}
    </section>
  );
}
