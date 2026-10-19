import { PERMISSIONS, ROLES, can, type Permission, type Role } from './roles';

/** Plain-words labels for the permission matrix dialog ("View permission matrix"). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'workspace.manage': 'Change workspace settings',
  'workspace.delete': 'Delete the workspace',
  'billing.manage': 'Manage billing and plan',
  'members.view': 'See the member list',
  'members.manage': 'Invite, remove and change roles',
  'teams.manage': 'Create and manage teams',
  'projects.view_all': 'See every project',
  'projects.create': 'Create projects',
  'projects.manage': 'Edit project settings',
  'tasks.view': 'See tasks',
  'tasks.create': 'Create tasks',
  'tasks.edit': 'Edit tasks',
  'tasks.delete': 'Delete tasks',
  'comments.create': 'Comment',
  'sprints.manage': 'Plan and run sprints',
  'reports.view': 'See dashboards',
  'approvals.decide': 'Approve or request changes',
};

export interface PermissionMatrixRow {
  permission: Permission;
  label: string;
  roles: Role[];
}

/** The role matrix as rows (permission → roles allowed), derived from the enforced policy. */
export const permissionMatrix = (): PermissionMatrixRow[] =>
  PERMISSIONS.map((permission) => ({
    permission,
    label: PERMISSION_LABELS[permission],
    roles: ROLES.filter((r) => can(r, permission)),
  }));
