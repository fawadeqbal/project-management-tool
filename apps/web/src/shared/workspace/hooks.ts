import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberDto, TagDto } from '@hearth/contracts';
import { api, type CreateTagRequest } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { toast } from '@/shared/toast/toast-store';
import { ApiError } from '@/shared/api/http';

const useSignedIn = () => !!useAuthStore((s) => s.token);

/** Sidebar data: favorites, teams, counts, onboarding progress. */
export function useShell() {
  return useQuery({
    queryKey: queryKeys.shell,
    queryFn: () => api.workspace.shell(),
    enabled: useSignedIn(),
    staleTime: 30_000,
  });
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: () => api.workspace.members(),
    enabled: useSignedIn(),
    staleTime: 5 * 60_000,
  });
}

/** id → member lookup for avatars and names. */
export function useMemberMap(): Map<string, MemberDto> {
  const { data } = useMembers();
  return useMemo(() => new Map((data ?? []).map((m) => [m.id, m])), [data]);
}

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => api.workspace.teams(),
    enabled: useSignedIn(),
    staleTime: 5 * 60_000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.workspace.tags(),
    enabled: useSignedIn(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateTag() {
  const client = useQueryClient();
  return useMutation<TagDto, ApiError, CreateTagRequest>({
    mutationFn: (input) => api.workspace.createTag(input),
    onSuccess: (tag) => client.setQueryData<TagDto[]>(queryKeys.tags, (old) => [...(old ?? []), tag]),
    onError: (err) => toast.error(ApiError.from(err).message),
  });
}
