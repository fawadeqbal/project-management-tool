import type { Role } from './roles';

/**
 * Paid seats: owners, admins and members. Viewers are free on every plan and guests never take a
 * seat — the plan copy promises both, so every seat counter (billing usage, members screen,
 * invite and reactivation limits) derives from this one rule.
 */
export const FREE_SEAT_ROLES = ['VIEWER', 'GUEST'] as const satisfies readonly Role[];
export const SEAT_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const satisfies readonly Role[];

export const roleTakesSeat = (role: Role): boolean => (SEAT_ROLES as readonly Role[]).includes(role);
