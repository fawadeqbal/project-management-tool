import { z } from 'zod';
import { IdSchema, RoleSchema, type AccentColorSchema, type UserRefDto } from './common';

// Contracts for the members bounded context (invites, roles, deactivation).

type Role = z.infer<typeof RoleSchema>;

export interface AdminMemberDto extends UserRefDto {
  email: string;
  role: Role;
  status: 'ACTIVE' | 'DEACTIVATED';
  isGuest: boolean;
  /** Guests: how many projects they can see ("Guest · 1 project"). */
  guestProjectCount: number | null;
  teams: { id: string; name: string; color: z.infer<typeof AccentColorSchema> }[];
  lastActiveAt: string;
  /** "Now", "5 min ago", "Yesterday", "Sep 2". */
  lastActiveLabel: string;
  isYou: boolean;
}

export interface MembersOverviewDto {
  members: AdminMemberDto[];
  counts: { members: number; guests: number; deactivated: number; pendingInvites: number; seatsUsed: number; seatLimit: number | null };
  plan: { id: string; name: string };
  identity: { sso: 'not_configured' | 'configured'; scim: 'available_on_enterprise' | 'enabled'; summary: string };
}

export interface InviteDto {
  id: string;
  email: string;
  role: Role;
  team: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  /** "Member · Design · sent 2 days ago" / "Guest · Website relaunch · expires in 2 days". */
  meta: string;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
}

export const CreateInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('That email is missing something — try lena@acme.com.'),
    role: RoleSchema.default('MEMBER'),
    teamId: IdSchema.nullish(),
    projectId: IdSchema.nullish(),
  })
  .refine((v) => v.role !== 'GUEST' || !!v.projectId, { message: 'Pick the project this guest can see.', path: ['projectId'] });
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;

export interface CreateInviteResultDto {
  invite: InviteDto;
  /** The accept link token (no email is sent in this build — share the link). */
  token: string;
}

export const ChangeRoleSchema = z.object({ role: RoleSchema });
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;

export const RemoveMemberSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: 'Removing someone can’t be undone. Confirm to continue.' }) }),
});
export type RemoveMemberInput = z.infer<typeof RemoveMemberSchema>;

export interface RoleInfoDto {
  role: Role;
  label: string;
  description: string;
}

export interface RolesDto {
  roles: RoleInfoDto[];
  matrix: { permission: string; label: string; roles: Role[] }[];
}

export interface AcceptInviteResultDto {
  workspaceId: string;
  role: Role;
  projectId: string | null;
}

export const MEMBERS_ROUTES = {
  members: '/admin/members',
  invites: '/admin/invites',
  invite: (id: string) => `/admin/invites/${id}`,
  resendInvite: (id: string) => `/admin/invites/${id}/resend`,
  acceptInvite: (token: string) => `/invites/${token}/accept`,
  role: (userId: string) => `/admin/members/${userId}/role`,
  deactivate: (userId: string) => `/admin/members/${userId}/deactivate`,
  reactivate: (userId: string) => `/admin/members/${userId}/reactivate`,
  member: (userId: string) => `/admin/members/${userId}`,
  roles: '/admin/roles',
} as const;
