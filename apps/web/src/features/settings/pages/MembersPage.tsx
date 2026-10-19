import { useMemo, useState } from 'react';
import type { AdminMemberDto } from '@hearth/contracts';
import { ROLE_META, ROLES, type Role } from '@hearth/domain';
import { assignableRoles } from '../roles';
import { Button, Dialog, DropdownMenu, EmptyState, Icon, Input, Skeleton } from '@hearth/ui';
import { useAuthStore, usePermission } from '@/shared/auth';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { useMembersOverview } from '../api';
import { InviteDialog } from '../components/InviteDialog';
import { MembersTable } from '../components/MembersTable';
import { PendingInvites } from '../components/PendingInvites';
import { PermissionMatrixDialog } from '../components/PermissionMatrixDialog';
import { RolesCard } from '../components/RolesCard';
import { useInviteDialogStore } from '../invite-dialog-store';
import { useMemberActions } from '../use-member-actions';
import styles from '../settings.module.css';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Settings → Members (Roles.dc.html). */
export function MembersPage() {
  const { data, isLoading, error, refetch } = useMembersOverview();
  const canManage = usePermission('members.manage');
  const myRole = useAuthStore((s) => s.me?.workspace.role) as Role | undefined;
  const assignable = useMemo(() => assignableRoles(myRole), [myRole]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [removing, setRemoving] = useState<AdminMemberDto | null>(null);
  const inviteOpen = useInviteDialogStore((s) => s.open);
  const setInviteOpen = useInviteDialogStore((s) => s.setOpen);
  const actions = useMemberActions();

  const pageCommands = useMemo<Command[]>(
    () => [{ id: 'members.matrix', title: 'View permission matrix', group: 'Settings', icon: 'doc', keywords: ['roles', 'permissions'], run: () => setMatrixOpen(true) }],
    [],
  );
  useRegisterCommands(pageCommands);

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    data?.members.forEach((m) => m.teams.forEach((t) => map.set(t.id, t.name)));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.members ?? []).filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) &&
        (roleFilter === 'ALL' || m.role === roleFilter) &&
        (teamFilter === 'ALL' || m.teams.some((t) => t.id === teamFilter)),
    );
  }, [data, query, roleFilter, teamFilter]);

  if (isLoading)
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton width={200} height={30} />
        <Skeleton height={48} radius={10} />
        <Skeleton height={320} radius={10} />
      </div>
    );
  if (error || !data)
    return (
      <div className={styles.page}>
        <EmptyState icon="alert" title="Members didn’t load" description={error?.message ?? 'Try again in a moment.'} primaryAction={<Button onClick={() => void refetch()}>Try again</Button>} />
      </div>
    );

  const { counts, plan, identity } = data;
  const summary = [
    plural(counts.members, 'member'),
    plural(counts.guests, 'guest'),
    plural(counts.pendingInvites, 'pending invite'),
    counts.seatLimit === null ? `unlimited seats on ${plan.name}` : `${counts.seatsUsed} of ${counts.seatLimit} seats on ${plan.name}`,
  ].join(' · ');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.subtitle}>{summary}</p>
        </div>
        <Button variant="secondary" icon="doc" onClick={() => setMatrixOpen(true)}>
          Permission matrix
        </Button>
        {canManage ? (
          <Button icon="plus" onClick={() => setInviteOpen(true)}>
            Invite people
          </Button>
        ) : null}
      </div>

      <div className={styles.identity}>
        <Icon name="link" className={styles.identityIcon} />
        <span>
          <strong>{identity.summary}.</strong> People join by invite and sign in with email. Guests only see the project they’re invited to.
        </span>
        <a href="/settings/security">Manage SSO</a>
      </div>

      <div className={styles.filters}>
        <Input wrapperClassName={styles.search} icon="search" label="Search members" hideLabel placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <DropdownMenu
          label="Filter by role"
          trigger={
            <Button variant="secondary" size="sm" iconRight="chevron-down">
              Role: {roleFilter === 'ALL' ? 'All' : ROLE_META[roleFilter].label}
            </Button>
          }
          items={[{ id: 'ALL', label: 'All roles', onSelect: () => setRoleFilter('ALL') }, ...ROLES.map((r) => ({ id: r, label: ROLE_META[r].label, onSelect: () => setRoleFilter(r) }))]}
        />
        <DropdownMenu
          label="Filter by team"
          trigger={
            <Button variant="secondary" size="sm" iconRight="chevron-down">
              Team: {teamFilter === 'ALL' ? 'All' : (teams.find(([id]) => id === teamFilter)?.[1] ?? 'All')}
            </Button>
          }
          items={[{ id: 'ALL', label: 'All teams', onSelect: () => setTeamFilter('ALL') }, ...teams.map(([id, name]) => ({ id, label: name, onSelect: () => setTeamFilter(id) }))]}
        />
      </div>

      <MembersTable
        members={filtered}
        canManage={canManage}
        assignable={assignable}
        onRoleChange={(member, role) => actions.changeRole.mutate({ member, role })}
        onDeactivate={(m) => actions.deactivate.mutate(m)}
        onReactivate={(m) => actions.reactivate.mutate(m)}
        onRemove={setRemoving}
      />

      <div className={styles.cards}>
        <PendingInvites canManage={canManage} />
        <RolesCard onOpenMatrix={() => setMatrixOpen(true)} />
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} assignable={assignable} />
      <PermissionMatrixDialog open={matrixOpen} onClose={() => setMatrixOpen(false)} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        role="alertdialog"
        size="sm"
        title={`Remove ${removing?.name ?? ''} from the workspace?`}
        description="This can’t be undone. Their open tasks become unassigned; comments and history stay. To keep the door open, deactivate instead."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (removing && removing.status === 'ACTIVE') actions.deactivate.mutate(removing);
                setRemoving(null);
              }}
            >
              {removing?.status === 'ACTIVE' ? 'Deactivate instead' : 'Keep deactivated'}
            </Button>
            <Button
              variant="danger"
              loading={actions.remove.isPending}
              onClick={() => removing && actions.remove.mutate(removing, { onSettled: () => setRemoving(null) })}
            >
              Remove permanently
            </Button>
          </>
        }
      />
    </div>
  );
}
