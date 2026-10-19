import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingDto, PlanCardDto } from '@hearth/contracts';
import { ROLE_PERMISSIONS } from '@hearth/domain';
import { http } from '@/shared/api/http';
import type * as HttpModuleNs from '@/shared/api/http';
import { renderApp, signIn, testMe } from '@/test/render';
import { BillingPage } from './BillingPage';

type HttpModule = typeof HttpModuleNs;

vi.mock('@/shared/api/http', async (orig) => ({
  ...(await orig<HttpModule>()),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const mocked = vi.mocked(http);

const plan = (over: Partial<PlanCardDto> & Pick<PlanCardDto, 'id' | 'name'>): PlanCardDto => ({
  tagline: '',
  monthlyPerSeatCents: 1000,
  annualPerSeatCents: 800,
  priceLabel: { MONTHLY: '$10', ANNUAL: '$8' },
  priceNote: 'per seat / month',
  highlights: ['Something'],
  annualSavings: null,
  isCurrent: false,
  isRecommended: false,
  action: 'upgrade',
  lostFeatures: [],
  ...over,
});

const billing: BillingDto = {
  current: { plan: 'PRO', planName: 'Pro', interval: 'MONTHLY', status: 'ACTIVE', seats: 10, renewsAt: '2026-11-01T00:00:00Z', renewsLabel: 'Nov 1', pausedUntil: null },
  usage: [
    { meter: 'seats', label: 'Seats', icon: 'users', used: 9, limit: 10, usedLabel: '9', limitLabel: '10', pct: 90, note: '1 seat left · next seat is prorated', warning: false },
    { meter: 'automation_runs', label: 'Automation runs', icon: 'settings', used: 940, limit: 1000, usedLabel: '940', limitLabel: '1,000', pct: 94, note: 'Resets Nov 1 · on pace to hit the limit Oct 22', warning: true },
  ],
  alert: { meter: 'automation_runs', title: 'You’ve used 940 of 1,000 automation runs this month', body: 'Automation runs pause until Nov 1 — nothing is deleted.' },
  plans: [
    plan({ id: 'FREE', name: 'Free', priceLabel: { MONTHLY: '$0', ANNUAL: '$0' }, action: 'downgrade', lostFeatures: [{ id: 'timeline', name: 'Timeline' }, { id: 'workload', name: 'Workload' }, { id: 'guests', name: 'Guests' }] }),
    plan({ id: 'PRO', name: 'Pro', isCurrent: true, action: 'current', annualSavings: { perYearCents: 21_600, pct: 20, label: 'Save $216 a year' } }),
    plan({ id: 'BUSINESS', name: 'Business', priceLabel: { MONTHLY: '$20', ANNUAL: '$16' }, isRecommended: true, annualSavings: { perYearCents: 43_200, pct: 20, label: 'Save $432 a year' } }),
    plan({ id: 'ENTERPRISE', name: 'Enterprise', priceLabel: { MONTHLY: 'Custom', ANNUAL: 'Custom' }, action: 'contact' }),
  ],
  recommendedPlan: 'BUSINESS',
  canManage: true,
};

describe('BillingPage', () => {
  beforeEach(() => {
    signIn({ ...testMe, workspace: { ...testMe.workspace, role: 'OWNER' }, permissions: [...ROLE_PERMISSIONS.OWNER] });
    mocked.get.mockResolvedValue(billing as never);
  });
  afterEach(() => vi.clearAllMocks());

  it('shows usage meters with a warning and highlights the recommended plan', async () => {
    const { unmount } = renderApp(<BillingPage />, { route: '/settings/billing' });
    expect(await screen.findByText('Resets Nov 1 · on pace to hit the limit Oct 22')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('940 of 1,000 automation runs');
    const business = screen.getByRole('article', { name: 'Business' });
    expect(business).toHaveAttribute('data-recommended', 'true');
    expect(within(business).getByText('Recommended for you')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Pro' })).getByRole('button', { name: 'Current plan' })).toBeDisabled();
    expect(within(screen.getByRole('article', { name: 'Enterprise' })).getByRole('link', { name: 'Talk to sales' })).toBeInTheDocument();
    unmount();
  });

  it('toggles monthly/annual and shows the saving in money', async () => {
    const { unmount } = renderApp(<BillingPage />, { route: '/settings/billing' });
    const business = await screen.findByRole('article', { name: 'Business' });
    // Starts on the plan's own interval (monthly).
    expect(within(business).getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('Switch to annual to save $216 a year')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Annual' }));
    expect(within(business).getByText('$16')).toBeInTheDocument();
    expect(within(business).getByText('Save $432 a year')).toBeInTheDocument();
    expect(screen.getByText('Annual saves $216 a year on Pro')).toBeInTheDocument();
    unmount();
  });

  it('lists the features you would lose before downgrading, then confirms', async () => {
    mocked.post.mockResolvedValue({ billing, lostFeatures: ['timeline', 'workload', 'guests'] } as never);
    const { unmount } = renderApp(<BillingPage />, { route: '/settings/billing' });
    fireEvent.click(within(await screen.findByRole('article', { name: 'Free' })).getByRole('button', { name: 'Downgrade' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Move from Pro to Free?' });
    const lost = within(dialog).getByRole('list', { name: 'Features you’d lose' });
    expect(within(lost).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Timeline', 'Workload', 'Guests']);
    expect(mocked.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Downgrade to Free' }));
    await waitFor(() => expect(mocked.post).toHaveBeenCalledWith('/billing/plan', { plan: 'FREE', interval: 'MONTHLY', confirm: true }));
    unmount();
  });

  it('keeps pause, export and cancel reachable', async () => {
    const { unmount } = renderApp(<BillingPage />, { route: '/settings/billing' });
    expect(await screen.findByRole('button', { name: 'Pause billing for up to 3 months' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export all data' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel plan' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel Pro?' });
    expect(within(dialog).getByRole('button', { name: 'Pause instead' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Export your data' })).toBeInTheDocument();
    unmount();
  });
});
