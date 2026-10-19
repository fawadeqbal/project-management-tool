import { useState } from 'react';
import { Avatar, ViewTabs } from '@hearth/ui';
import type { TaskDetailDto } from '@hearth/contracts';
import { timeAgo } from '@/shared/tasks/dates';
import { MentionText } from './MentionText';
import styles from '../task-detail.module.css';

/** Comments | Activity tabs. The composer is rendered separately, pinned at the bottom. */
export function CommentsActivity({ task }: { task: TaskDetailDto }) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const now = new Date();
  return (
    <section aria-label="Discussion" className={styles.section}>
      <ViewTabs
        label="Discussion"
        value={tab}
        onChange={(id) => setTab(id === 'activity' ? 'activity' : 'comments')}
        tabs={[
          { id: 'comments', label: `Comments ${task.comments.length}`, controls: 'task-comments' },
          { id: 'activity', label: 'Activity', controls: 'task-activity' },
        ]}
      />
      {tab === 'comments' ? (
        <div id="task-comments" role="tabpanel" aria-label="Comments" className={styles.feed}>
          {task.comments.length === 0 ? <p className={styles.muted}>No comments yet. Ask a question or share an update — @ mentions notify people.</p> : null}
          {task.comments.map((c) => (
            <article key={c.id} className={styles.comment} aria-busy={c.id.startsWith('optimistic-') || undefined}>
              <Avatar initials={c.author.initials} name={c.author.name} color={c.author.avatarColor} />
              <div className={styles.commentBody}>
                <div className={styles.commentMeta}>
                  <strong>{c.author.name}</strong>{' '}
                  <time dateTime={c.createdAt} className={styles.muted}>
                    {c.id.startsWith('optimistic-') ? 'Sending…' : timeAgo(c.createdAt, now)}
                  </time>
                  {c.editedAt ? <span className={styles.muted}> · edited</span> : null}
                </div>
                <p className={styles.commentText}>
                  <MentionText body={c.body} mentions={c.mentions} />
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ol id="task-activity" role="tabpanel" aria-label="Activity" className={styles.activity}>
          {task.activity.length === 0 ? <li className={styles.muted}>No activity yet.</li> : null}
          {task.activity.map((a) => (
            <li key={a.id} className={styles.activityItem}>
              <Avatar initials={a.actor.initials} name={a.actor.name} color={a.actor.avatarColor} size={20} />
              <span>
                <strong>{a.actor.name}</strong> {a.summary}
              </span>
              <time dateTime={a.createdAt} className={styles.muted}>
                {timeAgo(a.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
