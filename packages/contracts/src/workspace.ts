import { z } from 'zod';
import { AccentColorSchema, type RoleSchema, type ProjectRefDto, type UserRefDto } from './common';

/** Basic directory of people in the workspace — powers assignee pickers, @mentions, avatars. */
export interface MemberDto extends UserRefDto {
  email: string;
  jobTitle: string | null;
  role: z.infer<typeof RoleSchema>;
  status: 'ACTIVE' | 'DEACTIVATED';
  lastActiveAt: string;
  capacityHoursPerDay: number;
  teams: { id: string; name: string; color: z.infer<typeof AccentColorSchema> }[];
}

export interface TeamDto {
  id: string;
  name: string;
  color: z.infer<typeof AccentColorSchema>;
  memberIds: string[];
}

/** Everything the app shell needs in one request: sidebar nav, favorites, teams, counts. */
export interface ShellDto {
  favorites: ProjectRefDto[];
  teams: TeamDto[];
  counts: { myTasks: number; inbox: number };
  onboarding: { completed: number; total: number; nextStep: string | null };
}

export interface TagDto {
  id: string;
  name: string;
  color: z.infer<typeof AccentColorSchema>;
}

export const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: AccentColorSchema.default('slate'),
});
export type CreateTagInput = z.infer<typeof CreateTagSchema>;

export const WORKSPACE_ROUTES = {
  members: '/members',
  teams: '/teams',
  tags: '/tags',
  shell: '/shell',
} as const;
