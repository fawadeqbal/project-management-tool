import { Avatar } from '@hearth/ui';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useMembers } from '@/shared/workspace/hooks';
import { PickerList } from './PickerList';
import { PropertyPopover, type PropertyPopoverProps } from './PropertyPopover';
import styles from './pickers.module.css';

export interface AssigneePickerProps extends Omit<PropertyPopoverProps, 'label' | 'children'> {
  value: string | null;
  onChange: (assigneeId: string | null) => void;
}

const UNASSIGNED = '__unassigned__';

/** Members with search; "Me" first, then everyone active, then Unassigned. */
export function AssigneePicker({ value, onChange, onOpenChange, ...popover }: AssigneePickerProps) {
  const { data: members = [], isLoading } = useMembers();
  const myId = useAuthStore((s) => s.me?.user.id);
  const active = members.filter((m) => m.status === 'ACTIVE');
  const sorted = [...active].sort((a, b) =>
    a.id === myId ? -1 : b.id === myId ? 1 : a.name.localeCompare(b.name),
  );
  return (
    <PropertyPopover {...popover} onOpenChange={onOpenChange} label="Change assignee">
      <PickerList
        label="Assignee"
        searchable
        placeholder="Assign to…"
        emptyText={isLoading ? 'Loading people…' : 'No one matches that name.'}
        options={[
          ...sorted.map((m) => ({
            id: m.id,
            text: `${m.name} ${m.email}`,
            label: (
              <span className={styles.option}>
                <Avatar initials={m.initials} name={m.name} color={m.avatarColor} size={20} />
                {m.name}
                {m.id === myId ? <span className={styles.muted}>(you)</span> : null}
              </span>
            ),
            hint: m.jobTitle ?? undefined,
            selected: m.id === value,
          })),
          {
            id: UNASSIGNED,
            text: 'Unassigned',
            label: 'Unassigned',
            icon: 'user-plus' as const,
            selected: value === null,
          },
        ]}
        onSelect={(id) => {
          onOpenChange(false);
          const next = id === UNASSIGNED ? null : id;
          if (next !== value) onChange(next);
        }}
      />
    </PropertyPopover>
  );
}
