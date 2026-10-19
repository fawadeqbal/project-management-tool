import { Inject, Injectable } from '@nestjs/common';
import type { BillingDto, PlanCardDto, UsageMeterDto } from '@hearth/contracts';
import {
  annualSavings,
  can,
  describePlanChange,
  FEATURE_LABELS,
  formatMeter,
  formatMoney,
  formatShortDate,
  METER_LABELS,
  METERS,
  PLAN_IDS,
  PLANS,
  periodBounds,
  recommendedPlan,
  usageMeter,
  type Actor,
  type Clock,
  type Feature,
  type Meter,
  type PlanId,
} from '@hearth/domain';
import { CLOCK } from '../../../shared/clock/clock';
import { PrismaSubscriptionRepository } from './prisma-subscription.repository';
import { UsageReader } from './usage.reader';

const priceLabel = (cents: number | null) => (cents === null ? 'Custom' : formatMoney(cents));

/** Read side of Billing & plan: current plan, usage meters with pacing, and the plan catalog. */
@Injectable()
export class BillingReadModel {
  constructor(
    private readonly subscriptions: PrismaSubscriptionRepository,
    private readonly usage: UsageReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(actor: Actor): Promise<BillingDto> {
    const now = this.clock.now();
    const sub = (await this.subscriptions.findByWorkspace(actor.workspaceId))!.toSnapshot();
    const used = await this.usage.read(actor.workspaceId, now);
    const plan = PLANS[sub.plan];
    const period = periodBounds(now);

    const usage: UsageMeterDto[] = METERS.map((meter) => {
      const m = usageMeter(meter, used[meter], plan.limits[meter], period, now);
      return {
        meter,
        label: METER_LABELS[meter].label,
        icon: METER_LABELS[meter].icon,
        used: m.used,
        limit: m.limit,
        usedLabel: formatMeter(meter, m.used),
        limitLabel: m.limit === null ? 'Unlimited' : formatMeter(meter, m.limit),
        pct: m.pct,
        note: m.note,
        warning: m.warning,
      };
    });

    const recommended = recommendedPlan(sub.plan);
    const seatsForPricing = Math.max(used.seats, 1);
    const plans: PlanCardDto[] = PLAN_IDS.map((id) => {
      const p = PLANS[id];
      const change = describePlanChange(sub.plan, id);
      const savings = annualSavings(id, seatsForPricing);
      return {
        id,
        name: p.name,
        tagline: p.tagline,
        monthlyPerSeatCents: p.monthlyPerSeatCents,
        annualPerSeatCents: p.annualPerSeatCents,
        priceLabel: { MONTHLY: priceLabel(p.monthlyPerSeatCents), ANNUAL: priceLabel(p.annualPerSeatCents) },
        priceNote: p.priceNote,
        highlights: p.highlights,
        annualSavings: savings
          ? { ...savings, label: `Save ${formatMoney(savings.perYearCents)} a year` }
          : null,
        isCurrent: id === sub.plan,
        isRecommended: id === recommended && id !== sub.plan,
        action:
          id === sub.plan
            ? 'current'
            : id === 'ENTERPRISE'
              ? 'contact'
              : change.direction === 'upgrade'
                ? 'upgrade'
                : 'downgrade',
        lostFeatures: (change.lostFeatures as Feature[]).map((f) => ({
          id: f,
          name: FEATURE_LABELS[f].name,
        })),
      };
    });

    return {
      current: {
        plan: sub.plan,
        planName: plan.name,
        interval: sub.interval,
        status: sub.status,
        seats: sub.seats,
        renewsAt: sub.renewsAt.toISOString(),
        renewsLabel: formatShortDate(sub.renewsAt),
        pausedUntil: sub.pausedUntil?.toISOString() ?? null,
      },
      usage,
      alert: this.alert(usage, sub.plan, recommended, period.resetsAt),
      plans,
      recommendedPlan: recommended,
      canManage: can(actor.role, 'billing.manage'),
    };
  }

  /** Banner: the metered limit you're closest to hitting, what happens, and what the next plan offers. */
  private alert(
    usage: UsageMeterDto[],
    current: PlanId,
    recommended: PlanId,
    resetsAt: Date,
  ): BillingDto['alert'] {
    const metered: Meter[] = ['automation_runs', 'ai_credits'];
    const hot = usage.filter((u) => u.warning && metered.includes(u.meter)).sort((a, b) => b.pct - a.pct)[0];
    if (!hot || hot.limit === null) return null;
    const label = METER_LABELS[hot.meter].plural;
    const pace = hot.note.includes('on pace')
      ? `At your current pace you’ll reach the limit on ${hot.note.split('limit ').pop()}. `
      : '';
    const next = PLANS[recommended];
    const nextLimit = next.limits[hot.meter];
    const upsell =
      recommended !== current && nextLimit !== hot.limit
        ? ` ${next.name} includes ${nextLimit === null ? 'unlimited' : formatMeter(hot.meter, nextLimit)} ${label}.`
        : '';
    return {
      meter: hot.meter,
      title: `You’ve used ${hot.usedLabel} of ${hot.limitLabel} ${label} this month`,
      body: `${pace}${label.charAt(0).toUpperCase()}${label.slice(1)} pause until ${formatShortDate(resetsAt)} — nothing is deleted.${upsell}`,
    };
  }
}
