import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PROJECT_ROUTES,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type MilestoneDto,
  type ProjectDetailDto,
  type ProjectSummaryDto,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
} from '@hearth/contracts';
import { http, type ApiError } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { toast } from '@/shared/toast/toast-store';

export type CreateProjectRequest = Omit<CreateProjectInput, 'color'> & { color?: CreateProjectInput['color'] };

/** HTTP calls for the projects context. */
export const projectsApi = {
  list: () => http.get<ProjectSummaryDto[]>(PROJECT_ROUTES.list),
  get: (id: string) => http.get<ProjectDetailDto>(PROJECT_ROUTES.byId(id)),
  create: (input: CreateProjectRequest) => http.post<ProjectDetailDto>(PROJECT_ROUTES.list, input),
  update: (id: string, input: UpdateProjectInput) => http.patch<ProjectDetailDto>(PROJECT_ROUTES.byId(id), input),
  favorite: (id: string) => http.post<{ isFavorite: boolean }>(PROJECT_ROUTES.favorite(id)),
  unfavorite: (id: string) => http.delete<{ isFavorite: boolean }>(PROJECT_ROUTES.favorite(id)),
  teamProjects: (teamId: string) => http.get<ProjectSummaryDto[]>(PROJECT_ROUTES.teamProjects(teamId)),
  createMilestone: (projectId: string, input: CreateMilestoneInput) => http.post<MilestoneDto>(PROJECT_ROUTES.milestones(projectId), input),
  updateMilestone: (id: string, input: UpdateMilestoneInput) => http.patch<MilestoneDto>(PROJECT_ROUTES.milestone(id), input),
};

export const projectKeys = {
  all: ['projects'] as const,
  list: () => ['projects', 'list'] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
  team: (teamId: string) => ['projects', 'team', teamId] as const,
};

/** Names seen so far, for breadcrumbs (route handles can't read the query cache). */
const names = new Map<string, string>();
export const projectNameFor = (id: string | undefined): string | undefined => (id ? names.get(id) : undefined);
const remember = <T extends { id: string; name: string }>(items: T[]): T[] => {
  items.forEach((p) => names.set(p.id, p.name));
  return items;
};

const useSignedIn = () => !!useAuthStore((s) => s.token);

export function useProjects() {
  return useQuery({ queryKey: projectKeys.list(), queryFn: async () => remember(await projectsApi.list()), enabled: useSignedIn(), staleTime: 30_000 });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? 'none'),
    queryFn: async () => remember([await projectsApi.get(id!)])[0]!,
    enabled: useSignedIn() && !!id,
    staleTime: 30_000,
  });
}

export function useTeamProjects(teamId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.team(teamId ?? 'none'),
    queryFn: async () => remember(await projectsApi.teamProjects(teamId!)),
    enabled: useSignedIn() && !!teamId,
  });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation<ProjectDetailDto, ApiError, CreateProjectRequest>({
    mutationFn: (input) => projectsApi.create(input),
    onSuccess: (project) => {
      remember([project]);
      client.setQueryData(projectKeys.detail(project.id), project);
      void client.invalidateQueries({ queryKey: projectKeys.all });
      void client.invalidateQueries({ queryKey: queryKeys.shell });
    },
  });
}

/** Optimistic project edit (health override, description, WIP limits…), rolled back on failure. */
export function useUpdateProject(id: string) {
  return useOptimisticMutation<ProjectDetailDto, UpdateProjectInput>({
    mutationFn: (input) => projectsApi.update(id, input),
    affects: () => [projectKeys.all, queryKeys.shell],
    apply: (client, input) =>
      client.setQueryData<ProjectDetailDto>(projectKeys.detail(id), (p) => {
        if (!p) return p;
        const next = { ...p, ...input, wipLimits: { ...p.wipLimits, ...(input.wipLimits ?? {}) } } as ProjectDetailDto;
        if (input.health) next.health = { health: input.health, ...HEALTH_LABELS[input.health] };
        return next;
      }),
    onSuccess: (project, _v, client) => client.setQueryData(projectKeys.detail(id), project),
  });
}

const HEALTH_LABELS = {
  ON_TRACK: { label: 'On track', icon: 'status-done', tone: 'success' },
  AT_RISK: { label: 'At risk', icon: 'alert', tone: 'warning' },
  OFF_TRACK: { label: 'Off track', icon: 'status-blocked', tone: 'danger' },
} as const;

/** Star toggle: optimistic in the index, detail and sidebar favorites, with Undo. */
export function useToggleFavorite() {
  const mutation = useOptimisticMutation<{ isFavorite: boolean }, { project: Pick<ProjectSummaryDto, 'id' | 'name' | 'color'>; favorite: boolean }>({
    mutationFn: ({ project, favorite }) => (favorite ? projectsApi.favorite(project.id) : projectsApi.unfavorite(project.id)),
    affects: () => [projectKeys.all, queryKeys.shell],
    apply: (client, { project, favorite }) => {
      client.setQueriesData<ProjectSummaryDto[] | ProjectDetailDto>({ queryKey: projectKeys.all }, (data) => {
        if (Array.isArray(data)) return data.map((p) => (p.id === project.id ? { ...p, isFavorite: favorite } : p));
        return data && data.id === project.id ? { ...data, isFavorite: favorite } : data;
      });
      client.setQueryData<{ favorites: { id: string; name: string; color: string }[] }>(queryKeys.shell, (shell) =>
        shell
          ? {
              ...shell,
              favorites: favorite
                ? [...shell.favorites.filter((f) => f.id !== project.id), { id: project.id, name: project.name, color: project.color }]
                : shell.favorites.filter((f) => f.id !== project.id),
            }
          : shell,
      );
    },
  });
  return (project: Pick<ProjectSummaryDto, 'id' | 'name' | 'color'>, favorite: boolean) => {
    void mutation.mutateAsync({ project, favorite }).catch(() => undefined);
    toast.show({
      id: `favorite-${project.id}`,
      message: favorite ? `${project.name} added to favorites` : `${project.name} removed from favorites`,
      icon: 'star',
      action: 'Undo',
      onAction: () => void mutation.mutateAsync({ project, favorite: !favorite }).catch(() => undefined),
    });
  };
}
