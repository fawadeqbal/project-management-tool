import { useRef } from 'react';
import { Avatar, PriorityIcon, ProgressBar, StatusPill, TaskCheckbox, toUiPriority, toUiStatus } from '@hearth/ui';
import type { SprintDetailDto, SprintTaskDto } from '@hearth/contracts';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { taskStub } from '../lib/task-stub';
import { PointsChip } from './PointsChip';
import styles from '../sprints.module.css';

interface Props {
  detail: SprintDetailDto;
  onToggled?: () => void;
  onMoveToBacklog?: (task: SprintTaskDto) => void;
}

/** "In this sprint": Space toggles done, Enter opens, J/K or arrows move between rows. */
export function SprintTaskList({ detail, onToggled, onMoveToBacklog }: Props) {
  const mutations = useTaskMutations();
  const panel = useTaskPanel();
  const listRef = useRef<HTMLDivElement>(null);
  const { tasks, progress } = detail;

  const toggle = (t: SprintTaskDto) => {
    void mutations.toggleDone(taskStub({ ...t, sprintId: detail.sprint.id })).then(() => onToggled?.());
  };

  const move = (from: HTMLElement, delta: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-sprint-row]') ?? [])];
    rows[rows.indexOf(from) + delta]?.focus();
  };

  return (
    <section aria-label="Sprint backlog" className={styles.panel}>
      <div className={styles.panelHead}>
        <strong className={styles.panelTitle}>In this sprint</strong>
        <span className={styles.panelSub}>
          {tasks.length} {tasks.length === 1 ? 'issue' : 'issues'} · {progress.totalPoints} points
        </span>
        <span className={styles.muted}>
          {progress.donePoints} / {progress.totalPoints} pts done
        </span>
        <span className={styles.progress}>
          <ProgressBar value={progress.donePct} tone="success" height={6} label="Sprint progress" />
        </span>
      </div>
      <div ref={listRef} role="list">
        {tasks.length === 0 ? <p className={styles.empty}>Nothing in this sprint yet. Add work from the backlog with Shift+S.</p> : null}
        {tasks.map((t) => {
          const done = t.status === 'DONE';
          return (
            <div
              key={t.id}
              role="listitem"
              tabIndex={0}
              data-sprint-row=""
              aria-label={`${t.key} ${t.title}, ${done ? 'done' : t.status.toLowerCase().replace('_', ' ')}, ${t.points ?? 'no'} points`}
              className={styles.row}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === ' ') {
                  e.preventDefault();
                  toggle(t);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  panel.open(t.key);
                } else if (e.key === 'ArrowDown' || e.key === 'j') {
                  e.preventDefault();
                  move(e.currentTarget, 1);
                } else if (e.key === 'ArrowUp' || e.key === 'k') {
                  e.preventDefault();
                  move(e.currentTarget, -1);
                } else if (e.key === 'Backspace' && onMoveToBacklog && !done) {
                  e.preventDefault();
                  onMoveToBacklog(t);
                }
              }}
            >
              <TaskCheckbox checked={done} label={done ? `Reopen ${t.title}` : `Mark ${t.title} as done`} onChange={() => toggle(t)} tabIndex={-1} />
              <PriorityIcon level={toUiPriority(t.priority)} />
              <span className={styles.key}>{t.key}</span>
              <button type="button" tabIndex={-1} className={done ? styles.titleDone : styles.title} onClick={() => panel.open(t.key)}>
                {t.title}
              </button>
              <span className={styles.status}>
                <StatusPill status={toUiStatus(t.status)} />
              </span>
              <PointsChip points={t.points} />
              {t.assignee ? (
                <Avatar initials={t.assignee.initials} name={t.assignee.name} color={t.assignee.avatarColor} size={24} />
              ) : (
                <span className={styles.avatarSpacer} aria-label="Unassigned" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
