import { Avatar, Badge, Button, DropdownMenu, Tag } from '@hearth/ui';
import type { AdminMemberDto } from '@hearth/contracts';
import { ROLE_META, type Role } from '@hearth/domain';
import { RoleMenu } from './RoleMenu';
import styles from '../settings.module.css';

export interface MemberRowProps {
  member: AdminMemberDto;
  canManage: boolean;
  assignable: readonly Role[];
  onRoleChange: (member: AdminMemberDto, role: Role) => void;
  onDeactivate: (member: AdminMemberDto) => void;
  onReactivate: (member: AdminMemberDto) => void;
  onRemove: (member: AdminMemberDto) => void;
}

/** One person: avatar, name/email, team tags, role picker, last active, row menu. */
export function MemberRow({ member: m, canManage, assignable, onRoleChange, onDeactivate, onReactivate, onRemove }: MemberRowProps) {
  const deactivated = m.status === 'DEACTIVATED';
  const outranked = !assignable.includes(m.role);
  const locked = !canManage || m.isYou || outranked || deactivated;
  const lockReason = m.isYou ? 'You can’t change your own role' : outranked ? `Only an ${ROLE_META[m.role].label.toLowerCase()} can change this` : undefined;
  return (
    <div role="row" className={`${styles.row} ${deactivated ? styles.rowMuted : ''}`} aria-label={m.name}>
      <span role="cell" className={styles.person}>
        <Avatar initials={m.initials} name={m.name} size={32} color={m.avatarColor} />
        <span className={styles.personText}>
          <span className={styles.personName}>
            {m.name}
            {m.isYou ? <span className={styles.you}> (you)</span> : null}
          </span>
          <span className={styles.personEmail}>
            {m.email}
            {deactivated ? ' · deactivated' : ''}
          </span>
        </span>
      </span>
      <span role="cell" className={styles.tags}>
        {m.isGuest ? (
          <Tag color="slate">
            Guest · {m.guestProjectCount ?? 0} project{m.guestProjectCount === 1 ? '' : 's'}
          </Tag>
        ) : (
          m.teams.map((t) => (
            <Tag key={t.id} color={t.color}>
              {t.name}
            </Tag>
          ))
        )}
      </span>
      <span role="cell">
        {deactivated ? (
          <Badge tone="neutral" icon="lock">
            Deactivated
          </Badge>
        ) : (
          <RoleMenu name={m.name} role={m.role} assignable={assignable} disabled={locked} disabledReason={lockReason} onChange={(r) => onRoleChange(m, r)} />
        )}
      </span>
      <span role="cell" className={styles.lastActive}>
        {m.lastActiveLabel}
      </span>
      <span role="cell">
        {canManage && !m.isYou && !outranked ? (
          <DropdownMenu
            label={`Actions for ${m.name}`}
            align="end"
            trigger={<Button variant="ghost" size="sm" icon="more" aria-label={`More actions for ${m.name}`} />}
            items={[
              deactivated
                ? { id: 'reactivate', label: 'Reactivate', icon: 'undo' as const, hint: 'Gives access back', onSelect: () => onReactivate(m) }
                : { id: 'deactivate', label: 'Deactivate', icon: 'lock' as const, hint: 'Reversible · keeps their work', onSelect: () => onDeactivate(m) },
              { id: 'remove', label: 'Remove from workspace', icon: 'trash' as const, danger: true, onSelect: () => onRemove(m) },
            ]}
          />
        ) : null}
      </span>
    </div>
  );
}
