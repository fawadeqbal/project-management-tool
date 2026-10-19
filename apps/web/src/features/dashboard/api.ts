import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { REPORTING_ROUTES, type DashboardDto, type DashboardWidgetId, type ReportRangeDto } from '@hearth/contracts';
import { http } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  view: (range: ReportRangeDto, projectId?: string) => ['dashboard', range, projectId ?? 'all'] as const,
};

export const dashboardApi = {
  get: (range: ReportRangeDto, projectId?: string) => http.get<DashboardDto>(REPORTING_ROUTES.dashboard, { range, projectId }),
  saveLayout: (widgets: DashboardWidgetId[]) => http.patch<{ layout: DashboardWidgetId[] }>(REPORTING_ROUTES.layout, { widgets }),
  schedule: (recipients: string[]) => http.post<{ schedule: { cadence: 'weekly'; recipients: string[] } }>(REPORTING_ROUTES.schedule, { cadence: 'weekly', recipients }),
};

export function useDashboard(range: ReportRangeDto, projectId?: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: dashboardKeys.view(range, projectId),
    queryFn: () => dashboardApi.get(range, projectId),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });
}
