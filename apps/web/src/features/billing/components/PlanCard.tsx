import type { BillingIntervalDto, PlanCardDto } from '@hearth/contracts';
import { Button, Icon } from '@hearth/ui';
import styles from '../billing.module.css';

export interface PlanCardProps {
  plan: PlanCardDto;
  interval: BillingIntervalDto;
  /** True when this plan is current but on the other billing interval. */
  canSwitchInterval: boolean;
  canManage: boolean;
  busy: boolean;
  onUpgrade: (plan: PlanCardDto) => void;
  onDowngrade: (plan: PlanCardDto) => void;
  onSwitchInterval: () => void;
}

/** One plan in the comparison; the recommended one gets the brand border and badge (Von Restorff). */
export function PlanCard({
  plan,
  interval,
  canSwitchInterval,
  canManage,
  busy,
  onUpgrade,
  onDowngrade,
  onSwitchInterval,
}: PlanCardProps) {
  const headingId = `plan-${plan.id}`;
  const ownerHint = canManage ? undefined : 'Only workspace owners can change the plan';
  return (
    <article
      aria-labelledby={headingId}
      className={`${styles.plan} ${plan.isRecommended ? styles.planRecommended : ''}`}
      data-recommended={plan.isRecommended || undefined}
    >
      {plan.isRecommended ? <span className={styles.planBadge}>Recommended for you</span> : null}
      {plan.isCurrent ? (
        <span className={`${styles.planBadge} ${styles.planBadgeCurrent}`}>Your plan</span>
      ) : null}
      <div className={styles.planHead}>
        <h3 id={headingId} className={styles.planName}>
          {plan.name}
        </h3>
        <span className={styles.planWho}>{plan.tagline}</span>
      </div>
      <div className={styles.planPrice}>
        <strong>{plan.priceLabel[interval]}</strong>
        <span>{plan.priceNote}</span>
        {interval === 'ANNUAL' && plan.annualSavings ? (
          <span className={styles.saving}>{plan.annualSavings.label}</span>
        ) : null}
      </div>
      <ul className={styles.features}>
        {plan.highlights.map((f) => (
          <li key={f}>
            <Icon name="check" />
            {f}
          </li>
        ))}
      </ul>
      {plan.action === 'current' ? (
        canSwitchInterval ? (
          <Button
            variant="secondary"
            onClick={onSwitchInterval}
            disabled={!canManage || busy}
            title={ownerHint}
          >
            Switch to {interval === 'ANNUAL' ? 'annual' : 'monthly'} billing
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            Current plan
          </Button>
        )
      ) : null}
      {plan.action === 'upgrade' ? (
        <Button
          variant={plan.isRecommended ? 'primary' : 'secondary'}
          onClick={() => onUpgrade(plan)}
          disabled={!canManage || busy}
          title={ownerHint}
        >
          Upgrade to {plan.name}
        </Button>
      ) : null}
      {plan.action === 'contact' ? (
        <a className="ht-btn ht-btn-secondary" href="mailto:sales@hearth.app?subject=Hearth%20Enterprise">
          Talk to sales
        </a>
      ) : null}
      {plan.action === 'downgrade' ? (
        <Button
          variant="ghost"
          onClick={() => onDowngrade(plan)}
          disabled={!canManage || busy}
          title={ownerHint}
        >
          Downgrade
        </Button>
      ) : null}
    </article>
  );
}
