export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'] as const;
export type Role = (typeof ROLES)[number];

/** Plain-language role descriptions shown next to the role picker (Members & roles screen). */
export const ROLE_META: Record<Role, { label: string; description: string; rank: number }> = {
  OWNER: {
    label: 'Owner',
    description: 'Everything, including billing and deleting the workspace.',
    rank: 0,
  },
  ADMIN: { label: 'Admin', description: 'Manage members, teams, security and integrations.', rank: 1 },
  MEMBER: {
    label: 'Member',
    description: 'Create and edit projects, tasks and docs in their teams.',
    rank: 2,
  },
  VIEWER: { label: 'Viewer', description: 'See and comment; can’t edit. Free on every plan.', rank: 3 },
  GUEST: {
    label: 'Guest',
    description: 'Only the projects they’re invited to. Never sees members or other projects.',
    rank: 4,
  },
};

export const PERMISSIONS = [
  'workspace.manage',
  'workspace.delete',
  'billing.manage',
  'members.view',
  'members.manage',
  'teams.manage',
  'projects.view_all',
  'projects.create',
  'projects.manage',
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'comments.create',
  'sprints.manage',
  'reports.view',
  'approvals.decide',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MEMBER_PERMS: Permission[] = [
  'members.view',
  'projects.view_all',
  'projects.create',
  'projects.manage',
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'comments.create',
  'sprints.manage',
  'reports.view',
  'approvals.decide',
];

/** The permission matrix — "one click away" on the Members screen, enforced by the API. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set(PERMISSIONS.filter((p) => p !== 'workspace.delete' && p !== 'billing.manage')),
  MEMBER: new Set(MEMBER_PERMS),
  VIEWER: new Set<Permission>([
    'members.view',
    'projects.view_all',
    'tasks.view',
    'comments.create',
    'reports.view',
  ]),
  // Guests only see projects they were added to; project-level checks narrow this further.
  GUEST: new Set<Permission>([
    'tasks.view',
    'tasks.create',
    'tasks.edit',
    'comments.create',
    'approvals.decide',
  ]),
};

export const can = (role: Role, permission: Permission): boolean => ROLE_PERMISSIONS[role].has(permission);
