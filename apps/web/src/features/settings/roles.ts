import { ROLE_META, ROLES, type Role } from '@hearth/domain';

/** Roles you may hand out: your own rank or below (only owners create owners). */
export const assignableRoles = (mine: Role | undefined): Role[] => (mine ? ROLES.filter((r) => ROLE_META[r].rank >= ROLE_META[mine].rank) : []);
