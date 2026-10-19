import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '@/shared/api/http';
import type * as HttpModuleNs from '@/shared/api/http';
import { renderApp, signIn, testMe } from '@/test/render';
import { dashboardFixture } from '../fixtures';
import { sortHealthRows } from '../health-sort';
import { DashboardPage } from './DashboardPage';

type HttpModule = typeof HttpModuleNs;

vi.mock('@/shared/api/http', async (orig) => ({
  ...(await orig<HttpModule>()),
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mocked = vi.mocked(http);
const limit = {
  feature: 'dashboards',
  allowed: false,
  featureName: 'Dashboards',
  pitch: 'Answer “are we on track?” without a spreadsheet.',
  requiredPlan: 'BUSINESS',
  requiredPlanName: 'Business',
  currentPlan: 'PRO',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    signIn({ ...testMe, workspace: { ...testMe.workspace, role: 'OWNER' } });
    mocked.get.mockImplementation(
      async (path: string) => (path.startsWith('/billing/limits') ? limit : dashboardFixture) as never,
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('renders KPI tiles with the delta tone as icon + text + color', async () => {
    const { unmount, container } = renderApp(<DashboardPage />, { route: '/dashboards' });
    await screen.findByText('251');
    const overdue = container.querySelector('[data-tone="bad"]') as HTMLElement;
    expect(within(overdue).getByText('Overdue now')).toBeInTheDocument();
    expect(overdue.querySelector('.ht-kpi-delta-danger')).toHaveTextContent('+3 (worse)');
    expect(container.querySelectorAll('.ht-kpi-delta-success')).toHaveLength(3);
    expect(screen.getByText('target 85%')).toBeInTheDocument();
    // Chart is accessible: <title>, <desc> and a hidden data table.
    expect(screen.getByRole('img', { name: /Tasks created versus completed per week/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Tasks created and completed per week/ })).toBeInTheDocument();
    unmount();
  });

  it('sorts the project health table by column with aria-sort', async () => {
    const { unmount } = renderApp(<DashboardPage />, { route: '/dashboards' });
    await screen.findByText('Mobile app v2');
    const table = screen.getByRole('table', { name: 'Project health' });
    const names = () =>
      within(table)
        .getAllByRole('link')
        .map((a) => a.textContent);
    expect(names()).toEqual(['Website relaunch', 'Q4 brand campaign', 'Mobile app v2']);

    fireEvent.click(within(table).getByRole('button', { name: /Progress/ }));
    expect(names()).toEqual(['Mobile app v2', 'Q4 brand campaign', 'Website relaunch']);
    expect(within(table).getByRole('columnheader', { name: /Progress/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    fireEvent.click(within(table).getByRole('button', { name: /Progress/ }));
    expect(names()).toEqual(['Website relaunch', 'Q4 brand campaign', 'Mobile app v2']);
    expect(within(table).getByRole('columnheader', { name: /Progress/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    fireEvent.click(within(table).getByRole('button', { name: /Health/ }));
    expect(names()[0]).toBe('Mobile app v2');
    expect(within(table).getByRole('link', { name: 'Mobile app v2' })).toHaveAttribute(
      'href',
      '/projects/p3',
    );
    unmount();
  });

  it('opens the upgrade prompt when saving the layout hits the plan limit', async () => {
    mocked.patch.mockRejectedValue(
      new ApiError({
        status: 402,
        kind: 'limit_reached',
        code: 'plan.feature.dashboards',
        message: 'Dashboards is part of Business.',
        details: { feature: 'dashboards', requiredPlan: 'BUSINESS' },
      }),
    );
    const { unmount } = renderApp(<DashboardPage />, { route: '/dashboards' });
    await screen.findByText('251');
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));
    expect(screen.getByRole('button', { name: 'Move Project health' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save layout' }));
    expect(await screen.findByRole('dialog', { name: 'Dashboards is part of Business' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/without a spreadsheet/)).toBeInTheDocument());
    unmount();
  });
});

describe('sortHealthRows', () => {
  it('is stable and puts the worst health first ascending', () => {
    const sorted = sortHealthRows(dashboardFixture.projects, { key: 'health', dir: 'asc' });
    expect(sorted.map((r) => r.health)).toEqual(['OFF_TRACK', 'AT_RISK', 'ON_TRACK']);
    expect(sortHealthRows(dashboardFixture.projects, { key: 'budget', dir: 'desc' })[0]!.project.name).toBe(
      'Mobile app v2',
    );
  });
});
