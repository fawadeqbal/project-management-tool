import type { ProjectRefDto, TaskRefDto, UserRefDto } from '@hearth/contracts';
import { isAccentColor, toDateOnly, type AccentColor } from '@hearth/domain';

/** Small, pure mappers shared by every read model so a user/project/task looks the same everywhere. */

export const accent = (value: string | null | undefined, fallback: AccentColor = 'slate'): AccentColor =>
  isAccentColor(value) ? value : fallback;

export const toUserRef = (u: { id: string; name: string; initials: string; avatarColor: string }): UserRefDto => ({
  id: u.id,
  name: u.name,
  initials: u.initials,
  avatarColor: accent(u.avatarColor, 'blue'),
});

export const toProjectRef = (p: { id: string; name: string; color: string }): ProjectRefDto => ({
  id: p.id,
  name: p.name,
  color: accent(p.color, 'blue'),
});

export const toTaskRef = (t: { id: string; number: number; title: string; status: TaskRefDto['status'] }, keyPrefix: string): TaskRefDto => ({
  id: t.id,
  key: `${keyPrefix}-${t.number}`,
  title: t.title,
  status: t.status,
});

/** Calendar date → "YYYY-MM-DD" (or null). */
export const dateOnly = (d: Date | null | undefined): string | null => (d ? toDateOnly(d) : null);

/** Timestamp → ISO string (or null). */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** Prisma select for user refs — keep read models consistent and lean. */
export const USER_REF_SELECT = { id: true, name: true, initials: true, avatarColor: true } as const;
export const PROJECT_REF_SELECT = { id: true, name: true, color: true } as const;
