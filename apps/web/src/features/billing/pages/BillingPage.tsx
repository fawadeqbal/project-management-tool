import { useEffect, useState } from 'react';
import type { BillingIntervalDto, PlanCardDto } from '@hearth/contracts';
import { Button, EmptyState, Icon, SegmentedControl, Skeleton } from '@hearth/ui';
import { formatMoney } from '@hearth/domain';
import { useToast } from '@/shared/toast';
import { billingApi, useBilling, useBillingMutation } from '../api';
import { DowngradeDialog } from '../components/DowngradeDialog';
import { PauseCancel } from '../components/PauseCancel';
import { PlanCard } from '../components/PlanCard';
import { UsageMeters } from '../components/UsageMeters';
import { useUpgradePrompt } from '../components/UpgradePrompt';
import styles from '../billing.module.css';

const INTERVAL_OPTIONS = [
  { id: 'MONTHLY', label: 'Monthly' },
  { id: 'ANNUAL', label: 'Annual' },
];

function BillingSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <Skeleton width={220} height={30} />
      <div className={styles.usage}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={112} radius={10} />
        ))}
      </div>
      <div className={styles.plans}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={320} radius={12} />
        ))}
      </div>
    </div>
  );
}

/** Billing & plan (Billing.dc.html). */
export function BillingPage() {
  const { data, isLoading, error, refetch } = useBilling();
  const [interval, setInterval] = useState<BillingIntervalDto>('ANNUAL');
  const [downgrade, setDowngrade] = useState<PlanCardDto | null>(null);
  const { show } = useToast();
  const upgradePrompt = useUpgradePrompt();
  const change = useBillingMutation(
    (vars: { plan: PlanCardDto; interval: BillingIntervalDto; confirm?: boolean }) =>
      billingApi.changePlan({ plan: vars.plan.id, interval: vars.interval, confirm: vars.confirm }),
  );

  // Start the toggle on the plan's own interval so "Current plan" is accurate.
  const currentInterval = data?.current.interval;
  useEffect(() => {
    if (currentInterval) setInterval(currentInterval);
  }, [currentInterval]);

  if (isLoading) return <BillingSkeleton />;
  if (error || !data)
    return (
      <div className={styles.page}>
        <EmptyState
          icon="alert"
          title="Billing didn’t load"
          description={error?.message ?? 'Try again in a moment.'}
          primaryAction={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      </div>
    );

  const { current, plans, alert, canManage } = data;
  const recommended = plans.find((p) => p.isRecommended);
  const currentPlan = plans.find((p) => p.isCurrent);
  const savingPlan = plans.find((p) => p.isCurrent && p.annualSavings) ?? recommended;
  const runChange = (plan: PlanCardDto, confirm = false) =>
    change.mutate(
      { plan, interval, confirm },
      {
        onSuccess: () => {
          setDowngrade(null);
          show({
            message: `You’re on ${plan.name}, billed ${interval === 'ANNUAL' ? 'annually' : 'monthly'}.`,
            icon: 'check',
          });
        },
        onError: (e) => {
          if (!upgradePrompt.handleError(e)) show({ message: e.message, tone: 'danger', icon: 'alert' });
        },
      },
    );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Billing &amp; plan</h1>
          <p className={styles.subtitle}>
            You’re on{' '}
            <strong>
              {current.planName}, billed {current.interval === 'ANNUAL' ? 'annually' : 'monthly'}
            </strong>{' '}
            ·{' '}
            {current.status === 'CANCELED'
              ? `ends ${current.renewsLabel}`
              : `next invoice ${current.renewsLabel}`}{' '}
            · {current.seats} seats
          </p>
        </div>
        <Button
          variant="secondary"
          icon="doc"
          onClick={() =>
            show({ message: 'Invoices arrive once a payment provider is connected.', tone: 'info' })
          }
        >
          Invoices
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            show({ message: 'Payment methods arrive once a payment provider is connected.', tone: 'info' })
          }
        >
          Payment method
        </Button>
      </div>

      {current.status !== 'ACTIVE' ? (
        <div className={styles.statusNote} role="status">
          <Icon name={current.status === 'PAUSED' ? 'clock' : 'alert'} />
          <span>
            {current.status === 'PAUSED'
              ? `Billing is paused until ${new Date(current.pausedUntil ?? current.renewsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}. Your workspace stays readable.`
              : `${current.planName} is canceled and ends ${current.renewsLabel}. Everything keeps working until then.`}
          </span>
        </div>
      ) : null}

      {alert ? (
        <div role="alert" className={styles.alert}>
          <Icon name="alert" size={20} className={styles.alertIcon} />
          <div className={styles.alertText}>
            <strong>{alert.title}</strong>
            <span>{alert.body}</span>
          </div>
          {recommended ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="arrow-up-right"
                onClick={() => upgradePrompt.open('dashboards')}
              >
                Preview {recommended.name}
              </Button>
              <Button
                size="sm"
                onClick={() => runChange(recommended)}
                disabled={!canManage || change.isPending}
              >
                Upgrade to {recommended.name}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <UsageMeters usage={data.usage} />

      <div className={styles.compareRow}>
        <h2 className={styles.h2}>Compare plans</h2>
        <SegmentedControl
          label="Billing period"
          options={INTERVAL_OPTIONS}
          value={interval}
          onChange={(v) => setInterval(v as BillingIntervalDto)}
        />
        {savingPlan?.annualSavings ? (
          <span className={styles.saving} aria-live="polite">
            {interval === 'ANNUAL'
              ? `Annual saves ${formatMoney(savingPlan.annualSavings.perYearCents)} a year on ${savingPlan.name}`
              : `Switch to annual to save ${formatMoney(savingPlan.annualSavings.perYearCents)} a year`}
          </span>
        ) : null}
      </div>

      <section aria-label="Plans" className={styles.plans}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            canSwitchInterval={plan.isCurrent && interval !== current.interval && plan.id !== 'FREE'}
            canManage={canManage}
            busy={change.isPending}
            onUpgrade={(p) => runChange(p)}
            onDowngrade={(p) => (p.lostFeatures.length ? setDowngrade(p) : runChange(p, true))}
            onSwitchInterval={() => runChange(plan)}
          />
        ))}
      </section>

      <PauseCancel billing={data} />

      <DowngradeDialog
        plan={downgrade}
        currentPlanName={currentPlan?.name ?? current.planName}
        busy={change.isPending}
        onClose={() => setDowngrade(null)}
        onConfirm={() => downgrade && runChange(downgrade, true)}
      />
      {upgradePrompt.element}
    </div>
  );
}
