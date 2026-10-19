import { DAY_MS, diffInDays } from '../shared/dates';
import { ValidationError } from '../shared/errors';
import { assertCanAssignRole } from './access-policy';
import { ROLE_META, type Role } from './roles';
import { roleTakesSeat } from './seats';

export const INVITE_TTL_DAYS = 7;

/**
 * Rules for a new invite: you can't invite someone above your own role, guests are scoped to
 * exactly one project (security by default), and invites expire after a week.
 */
export const validateInvite = (actorRole: Role, input: { role: Role; projectId?: string | null }): void => {
  assertCanAssignRole(actorRole, input.role);
  if (input.role === 'GUEST' && !input.projectId)
    throw new ValidationError(
      'invites.guest_project',
      'Pick the project this guest can see — guests only get access to one project.',
      { field: 'projectId' },
    );
};

export const inviteExpiry = (now: Date): Date => new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);

/** Whether a pending invite takes a seat when accepted (viewers and guests are free). */
export const inviteTakesSeat = (role: Role): boolean => roleTakesSeat(role);

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Pending-invite subtitle: "Member · Design · sent 2 days ago" or, for guests,
 * "Guest · Website relaunch · expires in 2 days".
 */
export const inviteMeta = (
  invite: {
    role: Role;
    teamName?: string | null;
    projectName?: string | null;
    sentAt: Date;
    expiresAt: Date;
  },
  now: Date,
): string => {
  const parts: string[] = [ROLE_META[invite.role].label];
  if (invite.role === 'GUEST') {
    if (invite.projectName) parts.push(invite.projectName);
    const left = diffInDays(now, invite.expiresAt);
    parts.push(left < 0 ? 'expired' : left === 0 ? 'expires today' : `expires in ${plural(left, 'day')}`);
  } else {
    if (invite.teamName) parts.push(invite.teamName);
    const ago = diffInDays(invite.sentAt, now);
    parts.push(ago <= 0 ? 'sent today' : ago === 1 ? 'sent yesterday' : `sent ${plural(ago, 'day')} ago`);
  }
  return parts.join(' · ');
};
