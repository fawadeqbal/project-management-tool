import { useState, type KeyboardEvent } from 'react';
import { Avatar, Button, Skeleton, StatusPill, Textarea, toUiStatus } from '@hearth/ui';
import type { InboxItemDto } from '@hearth/contracts';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { usePermission } from '@/shared/auth/use-permission';
import { useTask, timeAgo } from '@/shared/tasks';
import { isMac } from '@/shared/hotkeys/hotkey-service';
import { useToast } from '@/shared/toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import { DetailActions, type DetailActionHandlers } from './DetailActions';
import { QuotedText } from './QuotedText';
import styles from '../inbox.module.css';

/** A mention or reply: the task, the comment in context and a reply box (⌘↵ sends). */
export function ConversationDetail({ item, ...handlers }: { item: InboxItemDto } & DetailActionHandlers) {
  const { data: task, isLoading } = useTask(item.taskId);
  const canComment = usePermission('comments.create');
  const { show } = useToast();
  const client = useQueryClient();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const comment = task?.comments
    .filter((c) => c.author.id === item.actor?.id)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.createdAt) - Date.parse(item.createdAt)) -
        Math.abs(Date.parse(b.createdAt) - Date.parse(item.createdAt)),
    )[0];
  const authorFirst = item.actor?.name.split(' ')[0] ?? '';

  const send = async () => {
    const body = reply.trim();
    if (!body || !item.taskId || sending) return;
    setSending(true);
    try {
      await api.tasks.addComment(item.taskId, { body, parentId: comment?.parentId ?? comment?.id ?? null });
      setReply('');
      show({
        message: `Reply sent to ${item.taskKey ?? 'the task'}`,
        icon: 'send',
        action: 'Open task',
        onAction: handlers.onOpenTask,
      });
      void client.invalidateQueries({ queryKey: queryKeys.taskRoot });
    } catch (e) {
      show({ message: `Your reply wasn’t sent. ${ApiError.from(e).message}`, tone: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className={styles.detailInner}>
      <DetailActions {...handlers} />
      <div className={styles.detailHead}>
        <span className={styles.detailContext}>{item.context}</span>
        {isLoading ? (
          <Skeleton width="70%" height={28} />
        ) : (
          <h2 className={styles.detailTitle}>{task?.title ?? item.title}</h2>
        )}
        {task ? (
          <div className={styles.detailBy}>
            <StatusPill status={toUiStatus(task.status)} />
            {task.assignee ? (
              <span className={styles.inline}>
                <Avatar
                  initials={task.assignee.initials}
                  name={task.assignee.name}
                  color={task.assignee.avatarColor}
                  size={20}
                />
                {task.assignee.name}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <article className={styles.comment} aria-label={`${item.actor?.name ?? 'Someone'}’s comment`}>
        <Avatar
          initials={item.actor?.initials ?? '·'}
          name={item.actor?.name}
          color={item.actor?.avatarColor ?? 'slate'}
        />
        <div className={styles.commentBody}>
          <div className={styles.commentMeta}>
            <strong>{item.actor?.name ?? 'Someone'}</strong>{' '}
            <span className={styles.muted}>{timeAgo(comment?.createdAt ?? item.createdAt)}</span>
          </div>
          <p className={styles.commentText}>
            <QuotedText text={comment?.body ?? item.excerpt ?? ''} />
          </p>
        </div>
      </article>
      {item.taskId && canComment ? (
        <div className={styles.replyBox}>
          <Textarea
            label={`Reply to ${authorFirst}`}
            hideLabel
            placeholder={`Reply to ${authorFirst}…  ${isMac() ? '⌘↵' : 'Ctrl+Enter'} to send`}
            value={reply}
            rows={3}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className={styles.decisionRow}>
            <Button icon="send" onClick={() => void send()} loading={sending} disabled={!reply.trim()}>
              Reply
            </Button>
          </div>
        </div>
      ) : !item.taskId ? (
        <p className={styles.muted}>This conversation lives outside a task, so replies happen there.</p>
      ) : null}
    </div>
  );
}
