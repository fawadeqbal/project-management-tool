import { z } from 'zod';
import { AccentColorSchema, type RoleSchema } from './common';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'Add your name.').max(80),
  email: z.string().trim().toLowerCase().email('That email is missing something — try hello@acme.com.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  workspaceName: z.string().trim().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('That email is missing something — try hello@acme.com.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export interface MeUserDto {
  id: string;
  email: string;
  name: string;
  initials: string;
  avatarColor: z.infer<typeof AccentColorSchema>;
  jobTitle: string | null;
  theme: 'light' | 'dark' | 'system';
}

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  slug: string;
  keyPrefix: string;
  role: z.infer<typeof RoleSchema>;
}

export interface MeDto {
  user: MeUserDto;
  /** The workspace this request is scoped to (X-Workspace-Id header or the first membership). */
  workspace: WorkspaceSummaryDto;
  workspaces: WorkspaceSummaryDto[];
  /** Effective permissions for the current workspace — the UI hides what you can't do. */
  permissions: string[];
}

export interface AuthResponseDto {
  accessToken: string;
  me: MeDto;
}

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  avatarColor: AccentColorSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const AUTH_ROUTES = {
  register: '/auth/register',
  login: '/auth/login',
  me: '/me',
} as const;
