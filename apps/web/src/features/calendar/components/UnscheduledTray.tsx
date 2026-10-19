import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PriorityIcon, toUiPriority } from '@hearth/ui';
import type { ProjectRefDto, TaskDto } from '@hearth/contracts';
import styles from '../calendar.module.css';

function TrayItem({ task, onOpen, onPick, picked }: { task: TaskDto; onOpen: (t: TaskDto) => void; onPick: (t: TaskDto) => void; picked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `tray:${task.id}`, data: { task } });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        className={styles.trayItem}
        aria-pressed={picked}
        aria-label={`${task.key} ${task.title}. Press S to schedule with the keyboard, Enter to open.`}
        style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : undefined }}
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            e.stopPropagation();
            onPick(task);
          }
        }}
      >
        <PriorityIcon level={toUiPriority(task.priority)} />
        <span className={styles.trayTitle}>{task.title}</span>
      </button>
    </li>
  );
}

export interface UnscheduledTrayProps {
  tasks: readonly TaskDto[];
  legend: readonly ProjectRefDto[];
  picked: string | null;
  onOpen: (t: TaskDto) => void;
  onPick: (t: TaskDto) => void;
}

/** Open tasks without a due date; drag one onto a day (or press S, then Enter on a day). Drop a chip here to unschedule. */
export function UnscheduledTray({ tasks, legend, picked, onOpen, onPick }: UnscheduledTrayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray', data: { date: null } });
  return (
    <aside ref={setNodeRef} aria-label="Unscheduled tasks" className={styles.tray} data-over={isOver || undefined}>
      <div className={styles.trayHead}>
        <strong>Unscheduled</strong>
        <span className={styles.muted}>{tasks.length}</span>
      </div>
      <p className={styles.trayHint}>Drag a task onto a day to give it a due date.</p>
      {tasks.length ? (
        <ul className={styles.trayList}>
          {tasks.map((t) => (
            <TrayItem key={t.id} task={t} onOpen={onOpen} onPick={onPick} picked={picked === t.id} />
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Everything has a date.</p>
      )}
      {legend.length ? (
        <div className={styles.legend}>
          <strong className={styles.legendTitle}>Projects</strong>
          {legend.map((p) => (
            <span key={p.id} className={styles.legendItem}>
              <span className={styles.dot} style={{ background: `var(--accent-${p.color}-dot)` }} aria-hidden="true" />
              {p.name}
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
