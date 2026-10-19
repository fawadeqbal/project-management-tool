import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { ConflictError, ForbiddenError, ValidationError } from '../shared/errors';
import { formatShortDate } from '../shared/dates';
import { FEATURE_LABELS, PLANS, type BillingInterval, type Feature, type PlanId } from './plans';
import { describePlanChange } from './usage';

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELED';

export interface SubscriptionProps {
  workspaceId: string;
  plan: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  seats: number;
  renewsAt: Date;
  pausedUntil: Date | null;
}

const addMonths = (d: Date, months: number): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));

/**
 * Subscription aggregate (no payment provider: changes apply immediately). Downgrades that lose
 * features must be confirmed; cancel and pause are always available — never hidden.
 */
export class Subscription extends AggregateRoot<SubscriptionProps> {
  private constructor(id: string, props: SubscriptionProps) {
    super(id, props);
  }

  static restore(id: string, props: SubscriptionProps): Subscription {
    return new Subscription(id, { ...props });
  }

  get plan() {
    return this.props.plan;
  }
  get status() {
    return this.props.status;
  }
  toSnapshot(): Readonly<SubscriptionProps & { id: string }> {
    return { ...this.props, id: this.id };
  }

  /**
   * Switches plan and/or interval. `activeSeats` must fit the new plan's seat limit. Returns the
   * features lost (empty for upgrades) so the caller can echo them back.
   */
  changePlan(input: { plan: PlanId; interval: BillingInterval; confirm: boolean; activeSeats: number }, actorId: string, now: Date): { lostFeatures: Feature[] } {
    if (input.plan === 'ENTERPRISE')
      throw new ValidationError('billing.enterprise_contact', 'Enterprise is set up with our team. Use “Talk to sales” and we’ll reply within a day.');
    if (input.plan === this.props.plan && input.interval === this.props.interval && this.props.status === 'ACTIVE')
      throw new ConflictError('billing.same_plan', `You’re already on ${PLANS[input.plan].name}, billed ${input.interval.toLowerCase()}.`);
    const change = describePlanChange(this.props.plan, input.plan);
    const lostFeatures = change.lostFeatures as Feature[];
    if (lostFeatures.length && !input.confirm)
      throw new ConflictError(
        'billing.confirm_downgrade',
        `Moving to ${PLANS[input.plan].name} turns off ${lostFeatures.map((f) => FEATURE_LABELS[f].name).join(', ')}. Confirm to continue — your data stays.`,
        { lostFeatures, lostFeatureNames: lostFeatures.map((f) => FEATURE_LABELS[f].name), plan: input.plan },
      );
    const seatLimit = PLANS[input.plan].limits.seats;
    if (seatLimit !== null && input.activeSeats > seatLimit)
      throw new ConflictError(
        'billing.too_many_seats',
        `${PLANS[input.plan].name} allows ${seatLimit} people and you have ${input.activeSeats}. Deactivate ${input.activeSeats - seatLimit} first, or pick a bigger plan.`,
        { seatLimit, activeSeats: input.activeSeats },
      );
    const from = this.props.plan;
    this.props.plan = input.plan;
    this.props.interval = input.interval;
    this.props.status = 'ACTIVE';
    this.props.pausedUntil = null;
    if (seatLimit !== null) this.props.seats = Math.min(seatLimit, Math.max(this.props.seats, input.activeSeats));
    else this.props.seats = Math.max(this.props.seats, input.activeSeats);
    this.record(createEvent('billing.plan_changed', this.base(actorId, now), { from, to: input.plan, interval: input.interval, direction: change.direction, lostFeatures }));
    return { lostFeatures };
  }

  pause(months: number, actorId: string, now: Date): void {
    if (![1, 2, 3].includes(months)) throw new ValidationError('billing.pause_months', 'You can pause for 1, 2 or 3 months.');
    if (this.props.plan === 'FREE') throw new ConflictError('billing.pause_free', 'The Free plan has nothing to pause — you’re not being billed.');
    if (this.props.status === 'CANCELED') throw new ConflictError('billing.canceled', 'This plan is already canceled. Resume it first.');
    this.props.status = 'PAUSED';
    this.props.pausedUntil = addMonths(now, months);
    this.record(createEvent('billing.paused', this.base(actorId, now), { until: this.props.pausedUntil.toISOString(), months }));
  }

  resume(actorId: string, now: Date): void {
    if (this.props.status === 'ACTIVE') throw new ConflictError('billing.active', 'Billing is already active.');
    this.props.status = 'ACTIVE';
    this.props.pausedUntil = null;
    this.record(createEvent('billing.resumed', this.base(actorId, now), {}));
  }

  /** Cancels at the end of the current period; the workspace stays usable until then. */
  cancel(confirm: boolean, actorId: string, now: Date): void {
    if (!confirm) throw new ValidationError('billing.cancel_unconfirmed', `Confirm to cancel. You keep ${PLANS[this.props.plan].name} until ${formatShortDate(this.props.renewsAt)}.`);
    if (this.props.status === 'CANCELED') throw new ConflictError('billing.canceled', 'This plan is already canceled.');
    this.props.status = 'CANCELED';
    this.record(createEvent('billing.canceled', this.base(actorId, now), { endsAt: this.props.renewsAt.toISOString() }));
  }

  private base(actorId: string, now: Date) {
    return { workspaceId: this.props.workspaceId, actorId, aggregateId: this.id, occurredAt: now };
  }
}

/** Only owners touch billing (the role matrix's billing.manage), stated in plain words. */
export const assertCanManageBilling = (canManage: boolean): void => {
  if (!canManage) throw new ForbiddenError('forbidden.billing.manage', 'Only workspace owners can change billing. Ask an owner to make this change.');
};

export interface SubscriptionRepository {
  findByWorkspace(workspaceId: string): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
}

export const SUBSCRIPTION_REPOSITORY = Symbol('SubscriptionRepository');

/** The plan to suggest: the cheapest plan above the current one (Business from Pro). */
export const recommendedPlan = (current: PlanId): PlanId => {
  const order: PlanId[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
  const i = order.indexOf(current);
  return order[Math.min(order.length - 1, i + 1)]!;
};
