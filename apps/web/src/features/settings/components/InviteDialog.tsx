import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROJECT_ROUTES, type ProjectRefDto } from '@hearth/contracts';
import { ROLE_META, type Role } from '@hearth/domain';
import { Button, Dialog, Select, Textarea } from '@hearth/ui';
import { ApiError, http } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useShell, useTeams } from '@/shared/workspace/hooks';
import { useToast } from '@/shared/toast';
import { useUpgradePrompt } from '@/features/billing';
import { membersApi, membersKeys } from '../api';
import styles from '../settings.module.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const splitEmails = (raw: string): string[] => [
  ...new Set(
    raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
];

/** Projects for the guest picker: the projects list when available, otherwise sidebar favorites. */
function useProjectOptions(enabled: boolean) {
  const { data: shell } = useShell();
  const { data } = useQuery({
    queryKey: ['projects', 'list', 'invite-picker'],
    queryFn: async () => {
      const res = await http.get<ProjectRefDto[] | { items: ProjectRefDto[] }>(PROJECT_ROUTES.list);
      return Array.isArray(res) ? res : res.items;
    },
    enabled,
    retry: false,
    staleTime: 60_000,
  });
  return data?.length ? data : (shell?.favorites ?? []);
}

export interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Roles the current person may hand out. */
  assignable: readonly Role[];
}

/** "Invite people": emails, role (with plain-words descriptions), team, and a project for guests. */
export function InviteDialog({ open, onClose, assignable }: InviteDialogProps) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<{ field: 'emails' | 'projectId'; message: string } | null>(null);
  const emailsRef = useRef<HTMLTextAreaElement>(null);
  const { data: teams = [] } = useTeams();
  const projects = useProjectOptions(open);
  const client = useQueryClient();
  const { show } = useToast();
  const upgrade = useUpgradePrompt();

  useEffect(() => {
    if (open) {
      setEmails('');
      setRole('MEMBER');
      setTeamId('');
      setProjectId('');
      setError(null);
    }
  }, [open]);

  const send = useMutation<
    { sent: string[]; failed: { email: string; error: ApiError }[] },
    ApiError,
    string[]
  >({
    mutationFn: async (list) => {
      const sent: string[] = [];
      const failed: { email: string; error: ApiError }[] = [];
      for (const email of list) {
        try {
          await membersApi.invite({
            email,
            role,
            teamId: role === 'GUEST' ? null : teamId || null,
            projectId: role === 'GUEST' ? projectId : null,
          });
          sent.push(email);
        } catch (e) {
          const err = ApiError.from(e);
          failed.push({ email, error: err });
          if (err.kind === 'limit_reached') break; // no point trying the rest
        }
      }
      return { sent, failed };
    },
    onSuccess: ({ sent, failed }) => {
      void client.invalidateQueries({ queryKey: membersKeys.all });
      void client.invalidateQueries({ queryKey: queryKeys.shell });
      if (sent.length)
        show({
          message: sent.length === 1 ? `Invite sent to ${sent[0]}` : `${sent.length} invites sent`,
          icon: 'send',
        });
      const limit = failed.find((f) => f.error.kind === 'limit_reached');
      if (limit) {
        upgrade.handleError(limit.error);
        setEmails(failed.map((f) => f.email).join('\n'));
        return;
      }
      if (failed.length) {
        setEmails(failed.map((f) => f.email).join('\n'));
        setError({
          field: failed[0]!.error.field('projectId') ? 'projectId' : 'emails',
          message: failed[0]!.error.message,
        });
        return;
      }
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const list = splitEmails(emails);
    const bad = list.find((x) => !EMAIL.test(x));
    if (!list.length)
      return setError({ field: 'emails', message: 'Add at least one email, like lena@acme.com.' });
    if (bad)
      return setError({ field: 'emails', message: `“${bad}” is missing something — try lena@acme.com.` });
    if (role === 'GUEST' && !projectId)
      return setError({
        field: 'projectId',
        message: 'Pick the project this guest can see — guests only get one project.',
      });
    setError(null);
    send.mutate(list);
  };

  const count = splitEmails(emails).length;
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Invite people"
        description="They’ll get a link that works for 7 days. You can resend or revoke it any time."
        initialFocusRef={emailsRef}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" icon="send" loading={send.isPending}>
              {count > 1 ? `Send ${count} invites` : 'Send invite'}
            </Button>
          </>
        }
      >
        <form id="invite-form" className={styles.form} onSubmit={submit} noValidate>
          <Textarea
            ref={emailsRef}
            label="Emails"
            hint="Separate several with commas or new lines."
            placeholder="lena@acme.com, omar@acme.com"
            rows={3}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            error={error?.field === 'emails' ? error.message : undefined}
          />
          <fieldset className={styles.roleChoices}>
            <legend className={styles.legend}>Role</legend>
            {(['ADMIN', 'MEMBER', 'VIEWER', 'GUEST'] as const).map((r) => (
              <label
                key={r}
                className={`${styles.roleChoice} ${role === r ? styles.roleChoiceOn : ''} ${!assignable.includes(r) ? styles.roleChoiceOff : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  disabled={!assignable.includes(r)}
                  onChange={() => setRole(r)}
                />
                <span>
                  <strong>{ROLE_META[r].label}</strong>
                  <span>{ROLE_META[r].description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {role === 'GUEST' ? (
            <Select
              label="Project"
              hint="Guests see this project only — never other projects or the member list."
              placeholder="Choose a project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              error={error?.field === 'projectId' ? error.message : undefined}
            />
          ) : (
            <Select
              label="Team (optional)"
              placeholder="No team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
          )}
        </form>
      </Dialog>
      {upgrade.element}
    </>
  );
}
