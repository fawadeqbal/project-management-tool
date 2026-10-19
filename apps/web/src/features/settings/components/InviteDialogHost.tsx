import { useMemo } from 'react';
import type { Role } from '@hearth/domain';
import { useAuthStore } from '@/shared/auth';
import { useInviteDialogStore } from '../invite-dialog-store';
import { assignableRoles } from '../roles';
import { InviteDialog } from './InviteDialog';

/** The invite dialog bound to the shared open state, for screens outside Settings (Home). */
export function InviteDialogHost() {
  const open = useInviteDialogStore((s) => s.open);
  const setOpen = useInviteDialogStore((s) => s.setOpen);
  const myRole = useAuthStore((s) => s.me?.workspace.role) as Role | undefined;
  const assignable = useMemo(() => assignableRoles(myRole), [myRole]);
  return <InviteDialog open={open} onClose={() => setOpen(false)} assignable={assignable} />;
}
