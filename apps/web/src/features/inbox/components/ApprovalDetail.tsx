import { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Icon, Input, Skeleton, StatusPill, type BadgeTone, type Status } from '@hearth/ui';
import type { ApprovalDetailDto, ApproverDecisionDto, InboxItemDto } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useRegisterCommands } from '@/shared/commands';
import type { Command } from '@/shared/commands/command';
import { useToast } from '@/shared/toast';
import { useApproval, useDecideApproval } from '../api';
import { DetailActions, type DetailActionHandlers } from './DetailActions';
import styles from '../inbox.module.css';

const PILL: Record<ApproverDecisionDto, Status> = { APPROVED: 'done', PENDING: 'todo', CHANGES_REQUESTED: 'blocked' };

const dueBadge = (a: ApprovalDetailDto): { tone: BadgeTone; icon: 'clock' | 'check' | 'undo' | 'alert'; label: string } | null => {
  if (a.status === 'APPROVED') return { tone: 'success', icon: 'check', label: 'Approved' };
  if (a.status === 'CHANGES_REQUESTED') return { tone: 'neutral', icon: 'undo', label: 'Changes requested' };
  if (!a.dueLabel) return null;
  return { tone: a.dueTone === 'danger' ? 'danger' : a.dueTone === 'warning' ? 'warning' : 'neutral', icon: a.dueTone === 'danger' ? 'alert' : 'clock', label: a.dueLabel };
};

/** The approval request, decided inline: Approve / Request changes, optimistic, with Shift+A. */
export function ApprovalDetail({ item, ...handlers }: { item: InboxItemDto } & DetailActionHandlers) {
  const { data: approval, isLoading, error } = useApproval(item.approvalId);
  const meId = useAuthStore((s) => s.me?.user.id);
  const decide = useDecideApproval(meId);
  const { show } = useToast();
  const [note, setNote] = useState('');

  const requesterFirst = approval?.requester.name.split(' ')[0] ?? 'them';
  const canDecide = !!approval?.canDecide && !decide.isPending;

  const submit = (decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    if (!approval || !canDecide) return;
    decide.mutate(
      { id: approval.id, decision, note: note.trim() || null },
      {
        onSuccess: () =>
          show({ message: decision === 'APPROVED' ? `Approved · ${requesterFirst} will be notified` : `Changes requested · ${requesterFirst} will be notified`, icon: decision === 'APPROVED' ? 'check' : 'undo' }),
      },
    );
  };

  const commands = useMemo<Command[]>(
    () =>
      approval && canDecide
        ? [
            { id: 'inbox.approve', title: 'Approve', group: 'Actions', icon: 'check', shortcut: ['Shift+A'], keywords: ['approval', 'sign off'], run: () => submit('APPROVED') },
            { id: 'inbox.request-changes', title: 'Request changes', group: 'Actions', icon: 'undo', keywords: ['approval', 'reject'], run: () => submit('CHANGES_REQUESTED') },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit reads the latest note/approval
    [approval, canDecide, note],
  );
  useRegisterCommands(commands);

  if (isLoading) {
    return (
      <div className={styles.detailInner} aria-busy="true">
        <DetailActions {...handlers} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="80%" height={28} />
        <Skeleton height={96} />
      </div>
    );
  }
  if (error || !approval) {
    return (
      <div className={styles.detailInner}>
        <DetailActions {...handlers} />
        <p className={styles.muted}>We couldn’t load this approval. It may have been deleted, or you may no longer have access.</p>
      </div>
    );
  }

  const badge = dueBadge(approval);
  const mine = approval.approvers.find((a) => a.isMe);
  return (
    <div className={styles.detailInner}>
      <DetailActions
        {...handlers}
        badge={badge ? <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge> : null}
      />
      <div className={styles.detailHead}>
        <span className={styles.detailContext}>{approval.context}</span>
        <h2 className={styles.detailTitle}>{approval.title}</h2>
        <p className={styles.detailBy}>
          <Avatar initials={approval.requester.initials} name={approval.requester.name} color={approval.requester.avatarColor} />
          {approval.askedLine} · {approval.progressLabel}
        </p>
      </div>
      {approval.summary || approval.attachments.length ? (
        <div className={styles.quoteCard}>
          {approval.summary ? <p className={styles.quoteText}>“{approval.summary}”</p> : null}
          {approval.attachments.length ? (
            <div className={styles.chips}>
              {approval.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className={styles.chip}>
                  <Icon name={a.kind === 'doc' ? 'doc' : a.kind === 'link' ? 'link' : 'paperclip'} />
                  {a.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <section className={styles.approvers} aria-labelledby="approvers-heading">
        <strong id="approvers-heading" className={styles.approversTitle}>
          Approvers
        </strong>
        <ul className={styles.approverList}>
          {approval.approvers.map((a) => (
            <li key={a.user.id} className={styles.approver}>
              <Avatar initials={a.user.initials} name={a.user.name} color={a.user.avatarColor} />
              <span className={styles.grow}>
                {a.isMe ? 'You' : a.user.name}
                {a.note ? <span className={styles.approverNote}> · “{a.note}”</span> : null}
              </span>
              <StatusPill status={PILL[a.decision]} label={a.label} />
            </li>
          ))}
        </ul>
      </section>
      {approval.canDecide ? (
        <>
          <Input label={`Note for ${requesterFirst} (optional)`} placeholder="Add a note with your decision…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          <div className={styles.decisionRow}>
            <Button icon="check" onClick={() => submit('APPROVED')} disabled={!canDecide} aria-keyshortcuts="Shift+A">
              Approve
            </Button>
            <Button variant="secondary" icon="undo" onClick={() => submit('CHANGES_REQUESTED')} disabled={!canDecide}>
              Request changes
            </Button>
          </div>
        </>
      ) : mine && mine.decision !== 'PENDING' ? (
        <p className={styles.decided} role="status">
          <Icon name={mine.decision === 'APPROVED' ? 'check' : 'undo'} />
          {mine.decision === 'APPROVED' ? 'You approved this.' : 'You requested changes.'} {requesterFirst} has been notified.
        </p>
      ) : !mine ? (
        <p className={styles.muted}>You’re not an approver on this request.</p>
      ) : (
        <p className={styles.muted}>This request is closed.</p>
      )}
    </div>
  );
}
