import { Button, DropdownMenu } from '@hearth/ui';
import { ROLE_META, ROLES, type Role } from '@hearth/domain';

export interface RoleMenuProps {
  name: string;
  role: Role;
  /** Roles the current person may hand out (never above their own). */
  assignable: readonly Role[];
  disabled?: boolean;
  disabledReason?: string;
  onChange: (role: Role) => void;
}

/** Role picker with the plain-words description of each role next to it. */
export function RoleMenu({ name, role, assignable, disabled, disabledReason, onChange }: RoleMenuProps) {
  const trigger = (
    <Button variant="secondary" size="sm" iconRight="chevron-down" aria-label={`Role for ${name}: ${ROLE_META[role].label}`} disabled={disabled} title={disabledReason}>
      {ROLE_META[role].label}
    </Button>
  );
  if (disabled) return trigger;
  return (
    <DropdownMenu
      label={`Change role for ${name}`}
      trigger={trigger}
      items={[
        {
          id: 'roles',
          heading: 'Role',
          items: ROLES.filter((r) => r !== 'GUEST' || role === 'GUEST').map((r) => ({
            id: r,
            label: ROLE_META[r].label,
            hint: ROLE_META[r].description,
            icon: r === role ? ('check' as const) : undefined,
            disabled: !assignable.includes(r) || (r === 'GUEST' && role !== 'GUEST'),
            onSelect: () => {
              if (r !== role) onChange(r);
            },
          })),
        },
      ]}
    />
  );
}
