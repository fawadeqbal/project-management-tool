import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ONBOARDING_ROUTES,
  type ApplyTemplateResultDto,
  type OnboardingDto,
  type OnboardingStepIdDto,
  type ProjectTemplateDto,
} from '@hearth/contracts';
import { ApiError, http } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  progress: ['onboarding', 'progress'] as const,
  templates: ['onboarding', 'templates'] as const,
};

export const onboardingApi = {
  get: () => http.get<OnboardingDto>(ONBOARDING_ROUTES.onboarding),
  complete: (id: OnboardingStepIdDto) => http.post<OnboardingDto>(ONBOARDING_ROUTES.completeStep(id)),
  dismiss: () => http.post<OnboardingDto>(ONBOARDING_ROUTES.dismiss),
  templates: () => http.get<ProjectTemplateDto[]>(ONBOARDING_ROUTES.templates),
  apply: (id: string, name?: string) =>
    http.post<ApplyTemplateResultDto>(ONBOARDING_ROUTES.applyTemplate(id), name ? { name } : {}),
};

const useSignedIn = () => !!useAuthStore((s) => s.token);

export function useOnboarding() {
  return useQuery({ queryKey: onboardingKeys.progress, queryFn: onboardingApi.get, enabled: useSignedIn() });
}

export function useTemplates() {
  return useQuery({
    queryKey: onboardingKeys.templates,
    queryFn: onboardingApi.templates,
    enabled: useSignedIn(),
    staleTime: Infinity,
  });
}

export function useApplyTemplate() {
  const client = useQueryClient();
  return useMutation<ApplyTemplateResultDto, ApiError, { id: string; name?: string }>({
    mutationFn: async ({ id, name }) => {
      try {
        return await onboardingApi.apply(id, name);
      } catch (e) {
        throw ApiError.from(e);
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: onboardingKeys.progress });
      void client.invalidateQueries({ queryKey: queryKeys.shell });
      void client.invalidateQueries({ queryKey: ['projects'] });
      void client.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useCompleteStep() {
  const client = useQueryClient();
  return useMutation<OnboardingDto, ApiError, OnboardingStepIdDto>({
    mutationFn: (id) => onboardingApi.complete(id),
    onSuccess: (data) => {
      client.setQueryData(onboardingKeys.progress, data);
      void client.invalidateQueries({ queryKey: queryKeys.shell });
    },
  });
}
