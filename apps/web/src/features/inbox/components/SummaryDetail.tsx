import { Avatar, Icon, StatusPill, toUiStatus } from '@hearth/ui';
import type { InboxItemDto } from '@hearth/contracts';
import { useTask, dueInfo } from '@/shared/tasks';
import { itemIcon, localTime } from '../inbox-meta';
import { DetailActions, type DetailActionHandlers } from './DetailActions';
import styles from '../inbox.module.css';

/** Assignments, status changes, completions: a short summary of the task and "Open task". */
export function SummaryDetail({ item, ...handlers }: { item: InboxItemDto } & DetailActionHandlers) {
  const { data: task } = useTask(item.taskId);
  const due = task ? dueInfo(task.dueDate, { done: task.status === 'DONE' }) : null;
  return (
    <div className={styles.detailInner}>
      <DetailActions {...handlers} />
      <div className={styles.detailHead}>
        <span className={styles.detailContext}>
          <Icon name={itemIcon(item)} size={12} /> {item.context}
        </span>
        <h2 className={styles.detailTitle}>{task?.title ?? item.excerpt ?? item.title}</h2>
        <p className={styles.detailBy}>
          <Avatar initials={item.actor?.initials ?? '·'} name={item.actor?.name} color={item.actor?.avatarColor ?? 'slate'} />
          {item.title} · {localTime(item)}
        </p>
      </div>
      {task ? (
        <dl className={styles.facts}>
          <dt>Status</dt>
          <dd>
            <StatusPill status={toUiStatus(task.status)} />
          </dd>
          <dt>Assignee</dt>
          <dd>{task.assignee ? task.assignee.name : 'Unassigned'}</dd>
          <dt>Due</dt>
          <dd data-tone={due?.tone}>
            {due ? (
              <>
                {due.overdue ? <Icon name="alert" size={12} /> : null} {due.overdue ? `Overdue · ${due.label}` : due.label}
              </>
            ) : (
              'No due date'
            )}
          </dd>
          {task.blockedBy.length ? (
            <>
              <dt>Blocked by</dt>
              <dd>{task.blockedBy.map((b) => `${b.key} · ${b.title}`).join(', ')}</dd>
            </>
          ) : null}
        </dl>
      ) : item.excerpt ? (
        <div className={styles.quoteCard}>
          <p className={styles.quoteText}>“{item.excerpt}”</p>
        </div>
      ) : null}
    </div>
  );
}
