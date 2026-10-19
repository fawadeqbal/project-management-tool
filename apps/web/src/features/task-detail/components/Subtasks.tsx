import { useState, type KeyboardEvent } from 'react';
import { Icon, ProgressBar, TaskCheckbox } from '@hearth/ui';
import type { TaskDetailDto } from '@hearth/contracts';
import { isOptimisticId } from '@/shared/tasks/useTaskMutations';
import { BreakdownSlot } from './BreakdownSlot';
import styles from '../task-detail.module.css';

interface Props {
  task: TaskDetailDto;
  onToggle: (subtaskId: string) => void;
  onAdd: (title: string) => void;
  onOpen: (key: string) => void;
  readOnly?: boolean;
}

/** Subtasks with progress "2 / 4", checkboxes, inline add and the Break down slot. */
export function Subtasks({ task, onToggle, onAdd, onOpen, readOnly }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.status === 'DONE').length;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = title.trim();
      if (value) onAdd(value);
      setTitle('');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setTitle('');
      setAdding(false);
    }
  };

  return (
    <section aria-labelledby="subtasks-heading" className={styles.section}>
      <div className={styles.sectionHead}>
        <h3 id="subtasks-heading" className={styles.sectionTitle}>
          Subtasks
        </h3>
        {total ? (
          <>
            <span className={styles.muted}>
              {done} / {total}
            </span>
            <span className={styles.progress}>
              <ProgressBar
                value={Math.round((done / total) * 100)}
                tone="success"
                height={4}
                label={`Subtasks: ${done} of ${total} done`}
              />
            </span>
          </>
        ) : null}
        <span className={styles.grow} />
        {!readOnly ? <BreakdownSlot task={task} onAddSubtask={onAdd} /> : null}
      </div>
      <ul className={styles.subtasks}>
        {task.subtasks.map((s) => {
          const isDone = s.status === 'DONE';
          const pending = isOptimisticId(s.id);
          return (
            <li key={s.id} className={styles.subtask} data-done={isDone} aria-busy={pending || undefined}>
              <TaskCheckbox
                checked={isDone}
                label={isDone ? `Mark “${s.title}” as not done` : `Mark “${s.title}” as done`}
                onChange={() => !pending && onToggle(s.id)}
                disabled={readOnly || pending}
              />
              <button
                type="button"
                className={styles.subtaskTitle}
                onClick={() => !pending && onOpen(s.key)}
                disabled={pending}
              >
                {s.title}
              </button>
            </li>
          );
        })}
      </ul>
      {!readOnly ? (
        adding ? (
          <div className={styles.addSubtask}>
            <Icon name="plus" />
            <input
              autoFocus
              className={styles.inlineInput}
              value={title}
              placeholder="Subtask title, then Enter"
              aria-label="New subtask title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => !title && setAdding(false)}
            />
          </div>
        ) : (
          <button type="button" className={styles.addLink} onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add subtask
          </button>
        )
      ) : null}
    </section>
  );
}
