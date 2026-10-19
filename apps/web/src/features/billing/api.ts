import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BILLING_ROUTES,
  type BillingDto,
  type BillingIntervalDto,
  type ChangePlanResultDto,
  type FeatureLimitDto,
  type PlanIdDto,
  type WorkspaceExportDto,
} from '@hearth/contracts';
import { ApiError, http } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';

export const billingKeys = {
  all: ['billing'] as const,
  overview: ['billing', 'overview'] as const,
  limit: (feature: string) => ['billing', 'limit', feature] as const,
};

export const billingApi = {
  get: () => http.get<BillingDto>(BILLING_ROUTES.billing),
  limit: (feature: string) => http.get<FeatureLimitDto>(BILLING_ROUTES.limit(feature)),
  changePlan: (input: { plan: PlanIdDto; interval: BillingIntervalDto; confirm?: boolean }) => http.post<ChangePlanResultDto>(BILLING_ROUTES.plan, input),
  pause: (months: 1 | 2 | 3) => http.post<BillingDto>(BILLING_ROUTES.pause, { months }),
  resume: () => http.post<BillingDto>(BILLING_ROUTES.resume),
  cancel: () => http.post<BillingDto>(BILLING_ROUTES.cancel, { confirm: true }),
  export: () => http.get<WorkspaceExportDto>(BILLING_ROUTES.export),
};

export function useBilling() {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: billingKeys.overview, queryFn: billingApi.get, enabled: !!token });
}

export function useFeatureLimit(feature: string | null) {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: billingKeys.limit(feature ?? ''), queryFn: () => billingApi.limit(feature!), enabled: !!token && !!feature, staleTime: 60_000 });
}

/** Billing writes return the fresh BillingDto; we write it straight into the cache. */
export function useBillingMutation<TVars>(fn: (vars: TVars) => Promise<BillingDto | ChangePlanResultDto>) {
  const client = useQueryClient();
  return useMutation<BillingDto | ChangePlanResultDto, ApiError, TVars>({
    mutationFn: async (vars) => {
      try {
        return await fn(vars);
      } catch (err) {
        throw ApiError.from(err);
      }
    },
    onSuccess: (data) => {
      client.setQueryData(billingKeys.overview, 'billing' in data ? data.billing : data);
      // A plan change can unlock (or lock) features everywhere.
      void client.invalidateQueries({ queryKey: ['billing', 'limit'] });
    },
  });
}

/** Downloads the workspace export as a JSON file. */
export async function downloadExport(): Promise<void> {
  const data = await billingApi.export();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = data.workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  a.href = url;
  a.download = `${slug}-export-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
