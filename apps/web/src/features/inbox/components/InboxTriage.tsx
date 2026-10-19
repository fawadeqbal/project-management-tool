import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  ProgressBar,
  Skeleton,
  StatusIcon,
  type BadgeTone,
} from '@hearth/ui';
import type { ApprovalDetailDto, InboxItemDto, SnoozePresetDto } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useSwipe } from '@/shared/gestures/useSwipe';
import { useRealtimeEvent } from '@/shared/realtime';
import { useTaskPanel } from '@/shared/tasks';
import { useToast } from '@/shared/toast';
import { useApproval, useDecideApproval, useInbox, useInboxTriage } from '../api';
import { isApproval, itemIcon, localTime } from '../inbox-meta';
import { SnoozeMenu } from './SnoozeMenu';
import styles from '../inbox.module.css';

export const TRIAGE_PARAM = 'triage';

const SNOOZE_LABEL: Record<SnoozePresetDto, string> = {
  later_today: 'later today',
  tomorrow: 'tomorrow',
  next_week: 'next week',
};

/** "Jia Li requested your approval" → "requested your approval" (the name is shown in bold). */
const verbOf = (item: InboxItemDto) => {
  const name = item.actor?.name;
  return name && item.title.startsWith(name) ? item.title.slice(name.length).trim() : item.title;
};

const approvalBadge = (a: ApprovalDetailDto): { tone: BadgeTone; label: string } | null => {
  if (a.status === 'APPROVED') return { tone: 'success', label: 'Approved' };
  if (a.status === 'CHANGES_REQUESTED') return { tone: 'neutral', label: 'Changes requested' };
  if (!a.dueLabel) return null;
  const label = a.dueLabel.replace(/^Approval /, '');
  return {
    tone: a.dueTone === 'danger' ? 'danger' : a.dueTone === 'warning' ? 'warning' : 'neutral',
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
};

/** "Sara approved · waiting on you" */
const approverLine = (a: ApprovalDetailDto) => {
  const approved = a.approvers
    .filter((x) => !x.isMe && x.decision === 'APPROVED')
    .map((x) => x.user.name.split(' ')[0]);
  const mine = a.approvers.find((x) => x.isMe);
  const head = approved.length ? `${approved.join(', ')} approved` : a.progressLabel;
  return mine?.decision === 'PENDING' && a.status === 'PENDING' ? `${head} · waiting on you` : head;
};

function ApprovalBody({ item, onDecided }: { item: InboxItemDto; onDecided: () => void }) {
  const { data: approval, isLoading } = useApproval(item.approvalId);
  const meId = useAuthStore((s) => s.me?.user.id);
  const decide = useDecideApproval(meId);
  const { show } = useToast();

  if (isLoading || !approval) {
    return (
      <>
        <Skeleton width="80%" height={24} />
        <Skeleton height={64} />
      </>
    );
  }
  const first = approval.requester.name.split(' ')[0];
  const submit = (decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    decide.mutate(
      { id: approval.id, decision, note: null },
      {
        onSuccess: () =>
          show({
            message:
              decision === 'APPROVED'
                ? `Approved · ${first} will be notified`
                : `Changes requested · ${first} will be notified`,
            icon: decision === 'APPROVED' ? 'check' : 'undo',
          }),
      },
    );
    onDecided();
  };
  const attachment = approval.attachments[0];
  const badge = approvalBadge(approval);
  return (
    <>
      {badge ? (
        <span className={styles.triageBadge}>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </span>
      ) : null}
      <h2 className={styles.triageTitle}>{approval.title}</h2>
      {approval.summary ? <p className={styles.triageText}>{approval.summary}</p> : null}
      {attachment ? (
        <a href={attachment.url} target="_blank" rel="noreferrer" className={styles.triageLink}>
          <Icon
            name={attachment.kind === 'doc' ? 'doc' : attachment.kind === 'link' ? 'link' : 'paperclip'}
            size={20}
          />
          <span className={styles.grow}>{attachment.label}</span>
          <Icon name="arrow-up-right" />
        </a>
      ) : null}
      <span className={styles.triageApprovers}>
        <StatusIcon status={approval.status === 'PENDING' ? 'in-review' : 'done'} />
        {approverLine(approval)}
      </span>
      {approval.canDecide ? (
        <div className={styles.triageDecision}>
          <Button
            variant="secondary"
            size="lg"
            icon="undo"
            disabled={decide.isPending}
            onClick={() => submit('CHANGES_REQUESTED')}
          >
            Request changes
          </Button>
          <Button size="lg" icon="check" disabled={decide.isPending} onClick={() => submit('APPROVED')}>
            Approve
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Phone inbox triage (MobileInbox.dc.html): one item at a time as a card. Swipe left (or
 * Archive) archives, swipe right keeps it for later and moves on; both have buttons too, and
 * archive / snooze come with Undo. Progress counts the items in this session.
 */
export function InboxTriage() {
  const [, setParams] = useSearchParams();
  const { data, isLoading, refetch } = useInbox('all', false);
  const triage = useInboxTriage();
  const { show } = useToast();
  const panel = useTaskPanel();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  // The session queue: what was in the inbox when triage started, plus anything that arrives.
  const [queue, setQueue] = useState<InboxItemDto[]>([]);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    setQueue((q) => {
      const known = new Set(q.map((i) => i.id));
      const fresh = data.items.filter((i) => !known.has(i.id));
      const live = new Map(data.items.map((i) => [i.id, i]));
      const updated = q.map((i) => live.get(i.id) ?? i);
      return fresh.length || q.some((i, n) => updated[n] !== i) ? [...updated, ...fresh] : q;
    });
  }, [data]);
  useRealtimeEvent('notification.created', () => void refetch());

  // Toasts sit above the triage action bar, not on top of it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--toast-bottom', 'calc(108px + env(safe-area-inset-bottom, 0px))');
    return () => void root.style.removeProperty('--toast-bottom');
  }, []);

  const position = queue.findIndex((i) => !handled.has(i.id));
  const current = position >= 0 ? queue[position]! : null;
  const total = queue.length;
  const left = total - handled.size;

  const cardRef = useRef<HTMLElement>(null);
  const acted = useRef(false);
  useEffect(() => {
    // After an action, move focus to the next card so keyboard and screen-reader users follow
    // along (not on first load: the page starts at the top like any other).
    if (!acted.current || !current) return;
    const active = document.activeElement;
    if (active && active !== document.body && !cardRef.current?.parentElement?.contains(active)) return;
    cardRef.current?.focus({ preventScroll: true });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- refocus per card only

  const markHandled = (id: string, value: boolean) => {
    acted.current = true;
    setHandled((h) => {
      const next = new Set(h);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const keep = (item: InboxItemDto) => {
    markHandled(item.id, true);
    if (item.unread) void triage.mutate({ action: 'read', ids: [item.id] });
  };

  const archive = (item: InboxItemDto) => {
    markHandled(item.id, true);
    void triage.mutate({ action: 'archive', ids: [item.id] });
    show({
      message: 'Archived',
      icon: 'archive',
      action: 'Undo',
      onAction: () => {
        markHandled(item.id, false);
        void triage.mutate({ action: 'unarchive', ids: [item.id], restore: [item] });
      },
    });
  };

  const snooze = (item: InboxItemDto, preset: SnoozePresetDto) => {
    setSnoozeOpen(false);
    markHandled(item.id, true);
    void triage.mutate({ action: 'snooze', ids: [item.id], preset });
    show({
      message: `Snoozed until ${SNOOZE_LABEL[preset]}`,
      icon: 'clock',
      action: 'Undo',
      onAction: () => {
        markHandled(item.id, false);
        void triage.mutate({ action: 'unsnooze', ids: [item.id], restore: [item] });
      },
    });
  };

  const swipe = useSwipe({
    enabled: !!current,
    exit: true,
    onSwipe: (dir) => {
      if (!current) return;
      if (dir === 'left') archive(current);
      else keep(current);
    },
  });

  const leave = () =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete(TRIAGE_PARAM);
      return n;
    });

  const progress = useMemo(() => (total ? (handled.size / total) * 100 : 0), [handled.size, total]);
  const loading = isLoading && !data;

  return (
    <div className={styles.triage}>
      <header className={styles.triageHead}>
        <div className={styles.titleRow}>
          <h1 className={styles.triageH1}>Inbox</h1>
          <Button variant="ghost" className={styles.triageListLink} onClick={leave}>
            List view
          </Button>
        </div>
        {total ? (
          <div className={styles.triageProgress}>
            <span className={styles.grow} aria-live="polite">
              Triage · {current ? `${position + 1} of ${total}` : 'done'}
            </span>
            <span className={styles.triageBar}>
              <ProgressBar value={progress} label="Triage progress" />
            </span>
          </div>
        ) : null}
      </header>

      <div className={styles.triageStage}>
        {loading ? (
          <div className={styles.triageCard}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="80%" height={24} />
            <Skeleton height={72} />
          </div>
        ) : current ? (
          <>
            <div className={styles.triageDeck}>
              {left > 2 ? <div aria-hidden="true" className={styles.triageGhost} data-depth="2" /> : null}
              {left > 1 ? <div aria-hidden="true" className={styles.triageGhost} data-depth="1" /> : null}
              <article
                key={current.id}
                ref={cardRef}
                tabIndex={-1}
                aria-label={current.title}
                className={styles.triageCard}
                data-dragging={swipe.dragging || undefined}
                style={swipe.style}
                {...swipe.handlers}
              >
                {swipe.direction && swipe.offset ? (
                  <span
                    aria-hidden="true"
                    className={styles.triageStamp}
                    data-action={swipe.direction === 'left' ? 'archive' : 'keep'}
                    data-armed={swipe.armed || undefined}
                  >
                    <Icon name={swipe.direction === 'left' ? 'archive' : 'arrow-right'} size={18} />
                    {swipe.direction === 'left' ? 'Archive' : 'Keep'}
                  </span>
                ) : null}
                <div className={styles.triageWho}>
                  <Avatar
                    initials={current.actor?.initials ?? '·'}
                    name={current.actor?.name}
                    size={40}
                    color={current.actor?.avatarColor ?? 'slate'}
                  />
                  <div className={styles.triageWhoText}>
                    <strong>{current.actor?.name ?? 'Hearth'}</strong>
                    <span>
                      {verbOf(current)} · <time dateTime={current.createdAt}>{localTime(current)}</time>
                    </span>
                  </div>
                </div>
                <span className={styles.triageWhere}>
                  <Icon name={itemIcon(current)} size={14} />
                  {current.context}
                </span>
                {isApproval(current) ? (
                  <ApprovalBody item={current} onDecided={() => keep(current)} />
                ) : current.excerpt ? (
                  <p className={styles.triageQuote}>{current.excerpt}</p>
                ) : null}
              </article>
            </div>
            <p className={styles.triageHint}>Swipe left to archive · right to keep for later</p>
          </>
        ) : (
          <EmptyState
            icon="inbox"
            title="You’re all caught up"
            description={
              total
                ? `You triaged ${total} ${total === 1 ? 'item' : 'items'}. New notifications will land in your inbox.`
                : 'Mentions, assignments and approvals land here as they happen.'
            }
            primaryAction={
              <Button variant="secondary" onClick={leave}>
                Back to inbox
              </Button>
            }
            headingLevel={2}
          />
        )}
      </div>

      {current ? (
        <nav aria-label="Triage actions" className={styles.triageActions}>
          <SnoozeMenu
            open={snoozeOpen}
            onOpenChange={setSnoozeOpen}
            onSnooze={(preset) => snooze(current, preset)}
            trigger={
              <button type="button" className={styles.triageAction}>
                <Icon name="clock" size={20} />
                Snooze
              </button>
            }
          />
          <button type="button" className={styles.triageAction} onClick={() => archive(current)}>
            <Icon name="archive" size={20} />
            Archive
          </button>
          <button type="button" className={styles.triageAction} onClick={() => keep(current)}>
            <Icon name="arrow-right" size={20} />
            Next
          </button>
          {current.taskKey ? (
            <button
              type="button"
              className={styles.triageAction}
              onClick={() => panel.open(current.taskKey!)}
            >
              <Icon name="arrow-up-right" size={20} />
              Open task
            </button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
