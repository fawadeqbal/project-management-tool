import { can, ROLES, type Permission, type Role } from '@hearth/domain';
import { useAuthStore } from './auth-store';

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

/**
 * Whether the current person may do something in this workspace. Uses the server's effective
 * permissions; falls back to the domain role matrix when they're missing. The API still enforces it.
 */
export function usePermission(permission: Permission): boolean {
  const me = useAuthStore((s) => s.me);
  if (!me) return false;
  if (me.permissions.length) return me.permissions.includes(permission);
  return isRole(me.workspace.role) ? can(me.workspace.role, permission) : false;
}
