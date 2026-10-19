import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InviteDto } from '@hearth/contracts';
import { Icon, Skeleton } from '@hearth/ui';
import { ApiError } from '@/shared/api/http';
import { useToast } from '@/shared/toast';
import { membersApi, membersKeys, useInvites } from '../api';
import styles from '../settings.module.css';

/** Pending invites with Resend / Revoke — nothing is a dead end. */
export function PendingInvites({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useInvites();
  const client = useQueryClient();
  const { show } = useToast();
  const refresh = () => void client.invalidateQueries({ queryKey: membersKeys.all });
  const fail = (e: unknown) => show({ message: ApiError.from(e).message, tone: 'danger', icon: 'alert' });

  const resend = useMutation({
    mutationFn: (i: InviteDto) => membersApi.resend(i.id),
    onSuccess: (_d, i) => {
      show({ message: `Invite resent to ${i.email}`, icon: 'send' });
      refresh();
    },
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: (i: InviteDto) => membersApi.revoke(i.id),
    onMutate: async (i) => {
      await client.cancelQueries({ queryKey: membersKeys.invites });
      const prev = client.getQueryData<InviteDto[]>(membersKeys.invites);
      client.setQueryData<InviteDto[]>(membersKeys.invites, (old) => old?.filter((x) => x.id !== i.id));
      return { prev };
    },
    onSuccess: (_d, i) => {
      show({
        message: `Invite for ${i.email} revoked`,
        action: 'Invite again',
        onAction: () =>
          void membersApi
            .invite({
              email: i.email,
              role: i.role,
              teamId: i.team?.id ?? null,
              projectId: i.project?.id ?? null,
            })
            .then(refresh, fail),
      });
      refresh();
    },
    onError: (e, _i, ctx) => {
      client.setQueryData(membersKeys.invites, ctx?.prev);
      fail(e);
    },
  });

  return (
    <section aria-labelledby="pending-invites" className={styles.card}>
      <h2 id="pending-invites" className={styles.cardTitle}>
        Pending invites
      </h2>
      {isLoading ? <Skeleton height={60} /> : null}
      {data && !data.length ? (
        <p className={styles.muted}>No pending invites. Everyone you invited has joined.</p>
      ) : null}
      <ul className={styles.inviteList}>
        {data?.map((i) => (
          <li key={i.id} className={styles.invite}>
            <Icon name="clock" className={styles.inviteIcon} />
            <span className={styles.inviteText}>
              <span>{i.email}</span>
              <span className={`${styles.inviteMeta} ${i.expired ? styles.inviteExpired : ''}`}>
                {i.meta}
              </span>
            </span>
            {canManage ? (
              <>
                <button
                  type="button"
                  className={styles.linkStrong}
                  onClick={() => resend.mutate(i)}
                  disabled={resend.isPending}
                  aria-label={`Resend invite to ${i.email}`}
                >
                  Resend
                </button>
                <button
                  type="button"
                  className={styles.linkQuiet}
                  onClick={() => revoke.mutate(i)}
                  aria-label={`Revoke invite for ${i.email}`}
                >
                  Revoke
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
