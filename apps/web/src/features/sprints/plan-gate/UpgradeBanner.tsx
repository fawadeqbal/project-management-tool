import { Link } from 'react-router-dom';
import { Icon } from '@hearth/ui';
import { usePlanGateStore } from './plan-gate-store';
import styles from './plan-gate.module.css';

/** Calm banner shown once a write for `feature` returned 402 in this session. */
export function UpgradeBanner({ feature, children }: { feature: string; children: string }) {
  const blocked = usePlanGateStore((s) => !!s.blocked[feature]);
  if (!blocked) return null;
  return (
    <div className={styles.banner} role="status">
      <Icon name="lock" className={styles.icon} />
      <span className={styles.bannerText}>{children}</span>
      <Link to="/settings/billing" className={styles.link}>
        See plans
      </Link>
    </div>
  );
}
