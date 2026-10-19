import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminMemberDto, MembersOverviewDto } from '@hearth/contracts';
import { ROLE_META, type Role } from '@hearth/domain';
import { ApiError } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { useToast } from '@/shared/toast';
import { membersApi, membersKeys } from './api';

const patchMember = (client: ReturnType<typeof useQueryClient>, userId: string, patch: Partial<AdminMemberDto>) =>
  client.setQueryData<MembersOverviewDto>(membersKeys.overview, (old) =>
    old ? { ...old, members: old.members.map((m) => (m.id === userId ? { ...m, ...patch } : m)) } : old,
  );

/** Role change, deactivate (with Undo), reactivate and remove — optimistic, rolled back on failure. */
export function useMemberActions() {
  const client = useQueryClient();
  const { show } = useToast();
  const affects = () => [membersKeys.overview];
  const afterwards = () => void client.invalidateQueries({ queryKey: queryKeys.members });

  const changeRole = useOptimisticMutation<unknown, { member: AdminMemberDto; role: Role }>({
    mutationFn: ({ member, role }) => membersApi.changeRole(member.id, role),
    affects,
    apply: (c, { member, role }) => patchMember(c, member.id, { role }),
    onSuccess: (_d, { member, role }) => {
      show({ message: `${member.name} is now ${ROLE_META[role].label === 'Admin' ? 'an' : 'a'} ${ROLE_META[role].label}`, action: 'Undo', onAction: () => changeRole.mutate({ member: { ...member, role }, role: member.role }) });
      afterwards();
    },
    errorMessage: (e) => e.message,
  });

  const reactivate = useOptimisticMutation<unknown, AdminMemberDto>({
    mutationFn: (m) => membersApi.reactivate(m.id),
    affects,
    apply: (c, m) => patchMember(c, m.id, { status: 'ACTIVE' }),
    onSuccess: (_d, m) => {
      show({ message: `${m.name} can sign in again` });
      afterwards();
    },
  });

  const deactivate = useOptimisticMutation<unknown, AdminMemberDto>({
    mutationFn: (m) => membersApi.deactivate(m.id),
    affects,
    apply: (c, m) => patchMember(c, m.id, { status: 'DEACTIVATED' }),
    onSuccess: (_d, m) => {
      show({ message: `${m.name} deactivated — their work stays`, action: 'Undo', onAction: () => reactivate.mutate({ ...m, status: 'DEACTIVATED' }) });
      afterwards();
    },
  });

  const remove = useMutation<{ unassignedTasks: number }, ApiError, AdminMemberDto>({
    mutationFn: async (m) => {
      try {
        return await membersApi.remove(m.id);
      } catch (e) {
        throw ApiError.from(e);
      }
    },
    onSuccess: ({ unassignedTasks }, m) => {
      client.setQueryData<MembersOverviewDto>(membersKeys.overview, (old) => (old ? { ...old, members: old.members.filter((x) => x.id !== m.id) } : old));
      show({ message: `${m.name} removed${unassignedTasks ? ` · ${unassignedTasks} open task${unassignedTasks === 1 ? '' : 's'} now unassigned` : ''}`, tone: 'info' });
      void client.invalidateQueries({ queryKey: membersKeys.all });
      afterwards();
    },
    onError: (e) => show({ message: e.message, tone: 'danger', icon: 'alert' }),
  });

  return { changeRole, deactivate, reactivate, remove };
}
