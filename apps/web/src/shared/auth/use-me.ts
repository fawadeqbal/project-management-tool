import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeDto } from '@hearth/contracts';
import { api } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from './auth-store';

/** The signed-in person, workspace and permissions. Seeded from the persisted store for an instant shell. */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const cached = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const query = useQuery<MeDto>({
    queryKey: [...queryKeys.me, workspaceId],
    queryFn: () => api.me.get(),
    enabled: !!token,
    initialData: cached && cached.workspace.id === workspaceId ? cached : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (query.data) setMe(query.data);
  }, [query.data, setMe]);
  return query;
}

/** First name for greetings: "Fawad Iqbal" → "Fawad". */
export const firstName = (name: string | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? '';
