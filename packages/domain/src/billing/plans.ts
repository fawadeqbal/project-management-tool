import { LimitReachedError } from '../shared/errors';

export const PLAN_IDS = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export const FEATURES = [
  'list_board_calendar',
  'timeline',
  'workload',
  'guests',
  'sprints',
  'dashboards',
  'goals',
  'time_tracking',
  'saml_sso',
  'advanced_permissions',
  'scim',
  'audit_log',
] as const;
export type Feature = (typeof FEATURES)[number];

export const METERS = ['seats', 'storage_bytes', 'automation_runs', 'ai_credits'] as const;
export type Meter = (typeof METERS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price per seat per month in USD cents; null = custom (contact sales). */
  monthlyPerSeatCents: number | null;
  /** Annual billing price per seat per month (cents). */
  annualPerSeatCents: number | null;
  priceNote: string;
  features: ReadonlySet<Feature>;
  /** null = unlimited. */
  limits: Record<Meter, number | null>;
  highlights: string[];
  recommended?: boolean;
}

const GB = 1024 ** 3;
const base: Feature[] = ['list_board_calendar'];
const pro: Feature[] = [...base, 'timeline', 'workload', 'guests'];
const business: Feature[] = [...pro, 'sprints', 'dashboards', 'goals', 'time_tracking', 'saml_sso', 'advanced_permissions'];

/**
 * Plan catalog. Prices are configuration, not code paths: changing a price never touches a
 * rule. (The design leaves list prices as [PRICE]; these are placeholders to replace.)
 */
export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'For trying Hearth with a small team.',
    monthlyPerSeatCents: 0,
    annualPerSeatCents: 0,
    priceNote: 'up to 5 people',
    features: new Set(base),
    limits: { seats: 5, storage_bytes: 1 * GB, automation_runs: 100, ai_credits: 50 },
    highlights: ['Unlimited tasks & projects', 'List, Board, Calendar', '100 automation runs / month', '1 GB storage'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For teams getting organized.',
    monthlyPerSeatCents: 1000,
    annualPerSeatCents: 800,
    priceNote: 'per seat / month',
    features: new Set(pro),
    limits: { seats: 10, storage_bytes: 100 * GB, automation_runs: 1000, ai_credits: 500 },
    highlights: ['Timeline & Workload', 'Unlimited guests', '1,000 automation runs / month', '100 GB storage'],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'For teams running several projects at once.',
    monthlyPerSeatCents: 2000,
    annualPerSeatCents: 1600,
    priceNote: 'per seat / month',
    features: new Set(business),
    limits: { seats: 500, storage_bytes: 1024 * GB, automation_runs: 10_000, ai_credits: 5000 },
    highlights: ['Portfolios, goals & dashboards', 'Sprints & time tracking', '10,000 automation runs / month', 'SAML SSO & advanced permissions'],
    recommended: true,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'For organizations with security and scale needs.',
    monthlyPerSeatCents: null,
    annualPerSeatCents: null,
    priceNote: 'annual contract',
    features: new Set(FEATURES),
    limits: { seats: null, storage_bytes: null, automation_runs: null, ai_credits: null },
    highlights: ['SCIM, audit log, data retention', 'IP allowlist & domain verification', 'Unlimited automations', 'Dedicated success manager'],
  },
};

export const FEATURE_LABELS: Record<Feature, { name: string; pitch: string }> = {
  list_board_calendar: { name: 'List, Board & Calendar', pitch: 'See work the way your team thinks.' },
  timeline: { name: 'Timeline', pitch: 'Plan with dependencies, milestones and the critical path.' },
  workload: { name: 'Workload', pitch: 'Spot who is overloaded before it becomes a late project.' },
  guests: { name: 'Guests', pitch: 'Invite clients to one project without exposing the rest.' },
  sprints: { name: 'Sprints', pitch: 'Plan sprints, track burndown and keep velocity honest.' },
  dashboards: { name: 'Dashboards', pitch: 'Answer “are we on track?” without a spreadsheet.' },
  goals: { name: 'Goals', pitch: 'Connect projects to the outcomes they serve.' },
  time_tracking: { name: 'Time tracking', pitch: 'Compare estimates with actuals.' },
  saml_sso: { name: 'SAML SSO', pitch: 'Sign in with your identity provider.' },
  advanced_permissions: { name: 'Advanced permissions', pitch: 'Fine-grained control per project.' },
  scim: { name: 'SCIM', pitch: 'Provision people automatically.' },
  audit_log: { name: 'Audit log', pitch: 'Every admin action, recorded.' },
};

/** The cheapest plan that includes a feature — the contextual upgrade target. */
export const cheapestPlanWith = (feature: Feature): Plan =>
  PLAN_IDS.map((id) => PLANS[id]).find((p) => p.features.has(feature)) ?? PLANS.ENTERPRISE;

/**
 * Plan limit policy: a Strategy-like lookup over the catalog. Throws a LimitReachedError that
 * names what the feature does and which plan unlocks it — no surprise walls.
 */
export class PlanLimitPolicy {
  constructor(private readonly plan: Plan) {}

  hasFeature(feature: Feature): boolean {
    return this.plan.features.has(feature);
  }

  assertFeature(feature: Feature): void {
    if (this.hasFeature(feature)) return;
    const target = cheapestPlanWith(feature);
    throw new LimitReachedError(
      `plan.feature.${feature}`,
      `${FEATURE_LABELS[feature].name} is part of ${target.name}. ${FEATURE_LABELS[feature].pitch}`,
      { feature, requiredPlan: target.id },
    );
  }

  /** Throws when consuming `amount` more of a meter would exceed the plan limit. */
  assertWithinLimit(meter: Meter, used: number, amount = 1): void {
    const limit = this.plan.limits[meter];
    if (limit === null || used + amount <= limit) return;
    const label = METER_LABELS[meter];
    throw new LimitReachedError(`plan.limit.${meter}`, `You’ve used all ${formatMeter(meter, limit)} ${label.plural} on ${this.plan.name}. Upgrade or wait for the reset.`, {
      meter,
      limit,
      used,
    });
  }
}

export const METER_LABELS: Record<Meter, { label: string; plural: string; icon: string }> = {
  seats: { label: 'Seats', plural: 'seats', icon: 'users' },
  storage_bytes: { label: 'Storage', plural: 'storage', icon: 'paperclip' },
  automation_runs: { label: 'Automation runs', plural: 'automation runs', icon: 'settings' },
  ai_credits: { label: 'AI credits', plural: 'AI credits', icon: 'sparkles' },
};

export const formatMeter = (meter: Meter, value: number): string => {
  if (meter === 'storage_bytes') {
    const gb = value / GB;
    return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${Math.round(value / 1024 ** 2)} MB`;
  }
  return value.toLocaleString('en-US');
};
