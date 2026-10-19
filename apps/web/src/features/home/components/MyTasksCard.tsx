import { Link } from 'react-router-dom';
import type { TaskDto } from '@hearth/contracts';
import { Button, Kbd, StatusIcon, toUiStatus } from '@hearth/ui';
import { dueInfo, useTaskPanel } from '@/shared/tasks';
import { PlateIllustration } from './PlateIllustration';
import styles from '../home.module.css';

/** My tasks on Home: the empty state from the design, or the next few open tasks. */
export function MyTasksCard({
  tasks,
  onCreate,
  onImport,
}: {
  tasks: TaskDto[] | undefined;
  onCreate: () => void;
  onImport: () => void;
}) {
  const panel = useTaskPanel();
  const open = (tasks ?? []).filter((t) => t.status !== 'DONE').slice(0, 5);
  if (open.length)
    return (
      <section aria-labelledby="home-my-tasks" className={`${styles.card} ${styles.myTasks}`}>
        <div className={styles.checklistHead}>
          <h2 id="home-my-tasks" className={styles.h2}>
            My tasks
          </h2>
          <Link to="/my-tasks" className={styles.link}>
            See all →
          </Link>
        </div>
        <ul className={styles.taskList}>
          {open.map((t) => {
            const due = dueInfo(t.dueDate, { done: false });
            return (
              <li key={t.id}>
                <button type="button" className={styles.taskButton} onClick={() => panel.open(t.key)}>
                  <StatusIcon status={toUiStatus(t.status)} />
                  <span className={styles.taskKey}>{t.key}</span>
                  <span className={styles.taskTitle}>{t.title}</span>
                  {due ? (
                    <span className={due.tone === 'danger' ? styles.dueDanger : styles.due}>{due.label}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={styles.tip}>
          Tip: press <Kbd keys="?" /> to see every shortcut
        </p>
      </section>
    );
  return (
    <section
      aria-labelledby="home-my-tasks"
      className={`${styles.card} ${styles.myTasks} ${styles.emptyCard}`}
    >
      <PlateIllustration />
      <h2 id="home-my-tasks" className={styles.h2}>
        Nothing on your plate yet
      </h2>
      <p className={styles.emptyText}>
        Tasks assigned to you land here, grouped by when they’re due. Create one now, or press C from
        anywhere.
      </p>
      <div className={styles.emptyActions}>
        <Button icon="plus" onClick={onCreate}>
          Create task
        </Button>
        <Button variant="ghost" onClick={onImport}>
          Import from Asana
        </Button>
      </div>
      <p className={styles.tip}>
        Tip: press <Kbd keys="?" /> to see every shortcut
      </p>
    </section>
  );
}
