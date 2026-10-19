import { useRef } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Icon, PriorityIcon, Tag, toUiPriority, type AccentColor } from '@hearth/ui';
import type { RankBacklogInput, SprintTaskDto } from '@hearth/contracts';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { neighboursFor } from '../lib/backlog-order';
import { PointsChip } from './PointsChip';
import styles from '../sprints.module.css';

const EPIC_COLORS: AccentColor[] = ['sky', 'violet', 'amber', 'green', 'rose', 'blue'];
/** Stable color per epic name. */
export const epicColor = (epic: string): AccentColor =>
  EPIC_COLORS[[...epic].reduce((a, c) => a + c.charCodeAt(0), 0) % EPIC_COLORS.length]!;

interface Props {
  tasks: SprintTaskDto[];
  /** Name of the sprint "Add to sprint" targets, or null when none can take work. */
  targetName: string | null;
  onRank: (input: RankBacklogInput) => void;
  onAddToSprint: (task: SprintTaskDto) => void;
  onFocusTask?: (task: SprintTaskDto | null) => void;
}

/**
 * Ranked backlog. Drag to rank (pointer or keyboard via dnd-kit), or focus a row and press
 * Alt+↑ / Alt+↓. Shift+S adds the focused row to the sprint. Estimates always visible.
 */
export function BacklogList({ tasks, targetName, onRank, onAddToSprint, onFocusTask }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const listRef = useRef<HTMLDivElement>(null);

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= tasks.length || from === to) return;
    onRank({ taskId: tasks[from]!.id, ...neighboursFor(tasks, from, to) });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    moveTo(
      tasks.findIndex((t) => t.id === active.id),
      tasks.findIndex((t) => t.id === over.id),
    );
  };

  const focusRow = (index: number) => {
    requestAnimationFrame(() =>
      listRef.current?.querySelectorAll<HTMLElement>('[data-backlog-row]')[index]?.focus(),
    );
  };

  return (
    <section aria-label="Product backlog" className={styles.panel}>
      <div className={styles.panelHead}>
        <strong className={styles.panelTitle}>Backlog</strong>
        <span className={styles.panelSub}>Ranked · drag into the sprint or press Shift+S</span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.empty}>
          The backlog is empty. New ideas land here, ranked by what matters most.
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div ref={listRef} role="list" aria-describedby="backlog-help">
            {tasks.map((t, i) => (
              <BacklogRow
                key={t.id}
                task={t}
                rank={i + 1}
                targetName={targetName}
                onAdd={() => onAddToSprint(t)}
                onFocus={() => onFocusTask?.(t)}
                onBlur={() => onFocusTask?.(null)}
                onMove={(delta) => {
                  moveTo(i, i + delta);
                  focusRow(i + delta);
                }}
                onStep={(delta) => focusRow(Math.max(0, Math.min(tasks.length - 1, i + delta)))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p id="backlog-help" className={styles.srOnly}>
        Use Alt plus arrow keys to change a task’s rank. Press Shift+S to add the focused task to the sprint.
      </p>
    </section>
  );
}

interface RowProps {
  task: SprintTaskDto;
  rank: number;
  targetName: string | null;
  onAdd: () => void;
  onMove: (delta: number) => void;
  onStep: (delta: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}

function BacklogRow({ task, rank, targetName, onAdd, onMove, onStep, onFocus, onBlur }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const panel = useTaskPanel();
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      tabIndex={0}
      data-backlog-row=""
      aria-label={`Rank ${rank}: ${task.key} ${task.title}, ${task.points ?? 'no'} points`}
      className={isDragging ? styles.rowDragging : styles.row}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onFocus={(e) => e.target === e.currentTarget && onFocus()}
      onBlur={(e) => {
        // Keep the selection when focus leaves the page (⌘K palette, a toast); clear it when it moves elsewhere on the page.
        const next = e.relatedTarget as HTMLElement | null;
        if (
          e.target === e.currentTarget &&
          next &&
          e.currentTarget.closest('main')?.contains(next) &&
          !next.closest('[data-backlog-row]')
        )
          onBlur();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onMove(e.key === 'ArrowUp' ? -1 : 1);
        } else if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          onStep(1);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          onStep(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          panel.open(task.key);
        }
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.grip}
        aria-label={`Drag to rank ${task.key}`}
        {...attributes}
        {...listeners}
        tabIndex={-1}
      >
        <Icon name="grip" size={14} />
      </button>
      <span className={styles.rank}>{rank}</span>
      <PriorityIcon level={toUiPriority(task.priority)} />
      <span className={styles.key}>{task.key}</span>
      <button type="button" tabIndex={-1} className={styles.title} onClick={() => panel.open(task.key)}>
        {task.title}
      </button>
      {task.epic ? <Tag color={epicColor(task.epic)}>{task.epic}</Tag> : null}
      <PointsChip points={task.points} />
      {targetName ? (
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          tabIndex={-1}
          className={styles.rowAction}
          aria-label={`Add ${task.key} to ${targetName}`}
          onClick={onAdd}
          title="Add to sprint (Shift+S)"
        >
          <span className={styles.rowActionText}>Add to sprint</span>
        </Button>
      ) : null}
    </div>
  );
}
