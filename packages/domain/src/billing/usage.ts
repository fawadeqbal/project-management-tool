import { addDays, diffInDays, formatShortDate, startOfDay } from '../shared/dates';
import { formatMeter, PLANS, type BillingInterval, type Meter, type PlanId } from './plans';

export interface UsageMeter {
  meter: Meter;
  used: number;
  limit: number | null;
  pct: number;
  /** "Resets Nov 1 · on pace to hit the limit Oct 22" */
  note: string;
  warning: boolean;
}

/**
 * Usage meters with pacing: limits are visible before they are hit. A meter warns at 90% or
 * when the current burn rate would reach the limit before the period resets.
 */
export const usageMeter = (
  meter: Meter,
  used: number,
  limit: number | null,
  period: { start: Date; resetsAt: Date },
  today: Date,
): UsageMeter => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const resets = `Resets ${formatShortDate(period.resetsAt)}`;
  if (limit === null) return { meter, used, limit, pct: 0, note: 'Unlimited', warning: false };
  if (meter === 'seats') {
    const left = limit - used;
    return {
      meter,
      used,
      limit,
      pct,
      note: left <= 0 ? 'No seats left · upgrade to invite more people' : `${left} seat${left === 1 ? '' : 's'} left · next seat is prorated`,
      warning: left <= 0,
    };
  }
  if (meter === 'storage_bytes') return { meter, used, limit, pct, note: pct >= 90 ? `${formatMeter(meter, limit - used)} left` : 'Plenty of room', warning: pct >= 90 };

  const elapsed = Math.max(1, diffInDays(period.start, today) + 1);
  const perDay = used / elapsed;
  const daysToLimit = perDay > 0 ? Math.ceil((limit - used) / perDay) : Infinity;
  const hitDate = addDays(startOfDay(today), daysToLimit);
  const hitsBeforeReset = Number.isFinite(daysToLimit) && hitDate.getTime() < startOfDay(period.resetsAt).getTime();
  if (used >= limit) return { meter, used, limit, pct, note: `Limit reached · ${resets.toLowerCase()}`, warning: true };
  if (hitsBeforeReset) return { meter, used, limit, pct, note: `${resets} · on pace to hit the limit ${formatShortDate(hitDate)}`, warning: true };
  return { meter, used, limit, pct, note: resets, warning: pct >= 90 };
};

/** Monthly / annual toggle shows the saving in money, not just a percentage. */
export const annualSavings = (planId: PlanId, seats: number): { perYearCents: number; pct: number } | null => {
  const p = PLANS[planId];
  if (p.monthlyPerSeatCents === null || p.annualPerSeatCents === null || p.monthlyPerSeatCents === 0) return null;
  const perYearCents = (p.monthlyPerSeatCents - p.annualPerSeatCents) * 12 * seats;
  return { perYearCents, pct: Math.round((1 - p.annualPerSeatCents / p.monthlyPerSeatCents) * 100) };
};

export const priceFor = (planId: PlanId, interval: BillingInterval): number | null => {
  const p = PLANS[planId];
  return interval === 'ANNUAL' ? p.annualPerSeatCents : p.monthlyPerSeatCents;
};

export const formatMoney = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Billing periods are calendar months: "YYYY-MM". */
export const periodKey = (d: Date): string => d.toISOString().slice(0, 7);
export const periodBounds = (d: Date): { start: Date; resetsAt: Date } => ({
  start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
  resetsAt: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
});

/** Moving between plans: what changes, in plain words (downgrade is always reachable). */
export const describePlanChange = (from: PlanId, to: PlanId): { direction: 'upgrade' | 'downgrade' | 'same'; lostFeatures: string[] } => {
  const order = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
  const direction = order.indexOf(to) > order.indexOf(from) ? 'upgrade' : order.indexOf(to) < order.indexOf(from) ? 'downgrade' : 'same';
  const lostFeatures = [...PLANS[from].features].filter((f) => !PLANS[to].features.has(f));
  return { direction, lostFeatures };
};
