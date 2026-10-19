import { Button, PriorityIcon, StatusPill, toUiPriority, toUiStatus } from '@hearth/ui';
import type { RetrospectiveDto, SprintTaskDto } from '@hearth/contracts';
import { PointsChip } from './PointsChip';
import styles from '../sprints.module.css';

function RetroList({ title, tasks }: { title: string; tasks: SprintTaskDto[] }) {
  return (
    <div className={styles.retroCol}>
      <h3 className={styles.retroHeading}>
        {title} <span className={styles.muted}>· {tasks.length}</span>
      </h3>
      <ul className={styles.retroList}>
        {tasks.map((t) => (
          <li key={t.id} className={styles.retroItem}>
            <PriorityIcon level={toUiPriority(t.priority)} />
            <span className={styles.key}>{t.key}</span>
            <span className={styles.retroTitle}>{t.title}</span>
            <StatusPill status={toUiStatus(t.status)} />
            <PointsChip points={t.points} />
          </li>
        ))}
        {tasks.length === 0 ? <li className={styles.muted}>None</li> : null}
      </ul>
    </div>
  );
}

/** The retrospective summary right after completing: what shipped, what moved, pre-sorted. */
export function RetrospectivePanel({ retro, onDismiss }: { retro: RetrospectiveDto; onDismiss: () => void }) {
  const where = retro.movedTo.kind === 'next' ? (retro.movedTo.sprint?.name ?? 'the next sprint') : 'the top of the backlog';
  return (
    <section aria-label="Retrospective" className={styles.retro}>
      <div className={styles.retroHead}>
        <div>
          <h2 className={styles.retroTitleMain}>{retro.sprint.name} is complete</h2>
          <p className={styles.muted}>
            {retro.completedPoints} of {retro.completedPoints + retro.unfinishedPoints} points done ({retro.completionPct}%).
            {retro.unfinished.length ? ` ${retro.unfinished.length} unfinished ${retro.unfinished.length === 1 ? 'task' : 'tasks'} moved to ${where}, furthest along first.` : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Done
        </Button>
      </div>
      <div className={styles.retroGrid}>
        <RetroList title="Completed" tasks={retro.completed} />
        <RetroList title="Unfinished" tasks={retro.unfinished} />
      </div>
    </section>
  );
}
