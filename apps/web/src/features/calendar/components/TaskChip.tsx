import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { StatusIcon, toUiStatus } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { STATUS_META } from '@hearth/domain';
import styles from '../calendar.module.css';

/** Task chip: project dot + status icon + title (struck through when done) — never color alone. */
export function TaskChip({ task, onOpen, draggable = true, overlay = false }: { task: TaskDto; onOpen?: (task: TaskDto) => void; draggable?: boolean; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `chip:${task.id}`, data: { task }, disabled: !draggable || overlay });
  const done = task.status === 'DONE';
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={styles.chip}
      data-done={done || undefined}
      data-overlay={overlay || undefined}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : undefined }}
      title={`${task.key} ${task.title}`}
      aria-label={`${task.key} ${task.title}, ${STATUS_META[task.status].label}${task.project ? `, ${task.project.name}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(task);
      }}
    >
      <span className={styles.dot} style={{ background: `var(--accent-${task.project?.color ?? 'slate'}-dot)` }} aria-hidden="true" />
      <StatusIcon status={toUiStatus(task.status)} size={12} />
      <span className={styles.chipTitle}>{task.title}</span>
    </button>
  );
}
