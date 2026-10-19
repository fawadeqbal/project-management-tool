import { useQuery } from '@tanstack/react-query';
import {
  MEMBERS_ROUTES,
  type AdminMemberDto,
  type CreateInviteInput,
  type CreateInviteResultDto,
  type InviteDto,
  type MembersOverviewDto,
  type RolesDto,
} from '@hearth/contracts';
import type { Role } from '@hearth/domain';
import { http } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';

export const membersKeys = {
  all: ['admin-members'] as const,
  overview: ['admin-members', 'overview'] as const,
  invites: ['admin-members', 'invites'] as const,
  roles: ['admin-members', 'roles'] as const,
};

export type InviteRequest = Omit<CreateInviteInput, 'role'> & { role?: CreateInviteInput['role'] };

export const membersApi = {
  overview: () => http.get<MembersOverviewDto>(MEMBERS_ROUTES.members),
  invites: () => http.get<InviteDto[]>(MEMBERS_ROUTES.invites),
  roles: () => http.get<RolesDto>(MEMBERS_ROUTES.roles),
  invite: (input: InviteRequest) => http.post<CreateInviteResultDto>(MEMBERS_ROUTES.invites, input),
  resend: (id: string) => http.post<InviteDto>(MEMBERS_ROUTES.resendInvite(id)),
  revoke: (id: string) => http.delete(MEMBERS_ROUTES.invite(id)),
  changeRole: (userId: string, role: Role) => http.patch<{ userId: string; role: Role }>(MEMBERS_ROUTES.role(userId), { role }),
  deactivate: (userId: string) => http.post<{ userId: string; status: AdminMemberDto['status'] }>(MEMBERS_ROUTES.deactivate(userId)),
  reactivate: (userId: string) => http.post<{ userId: string; status: AdminMemberDto['status'] }>(MEMBERS_ROUTES.reactivate(userId)),
  remove: (userId: string) => http.delete<{ userId: string; unassignedTasks: number }>(MEMBERS_ROUTES.member(userId), { body: { confirm: true } }),
};

const useSignedIn = () => !!useAuthStore((s) => s.token);

export function useMembersOverview() {
  return useQuery({ queryKey: membersKeys.overview, queryFn: membersApi.overview, enabled: useSignedIn() });
}

export function useInvites() {
  return useQuery({ queryKey: membersKeys.invites, queryFn: membersApi.invites, enabled: useSignedIn() });
}

export function useRoles(enabled = true) {
  return useQuery({ queryKey: membersKeys.roles, queryFn: membersApi.roles, enabled: useSignedIn() && enabled, staleTime: Infinity });
}
