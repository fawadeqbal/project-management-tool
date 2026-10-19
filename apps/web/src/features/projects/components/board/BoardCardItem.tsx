import { memo, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BoardCard } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { taskRowProps } from '@/shared/tasks/task-row-props';
import { isOptimisticId } from '@/shared/tasks/useTaskMutations';

export interface BoardCardItemProps {
  task: TaskDto;
  columnId: string;
  muted?: boolean;
  onOpen: (task: TaskDto) => void;
  onFocusCard: (task: TaskDto) => void;
  onCardKeyDown: (task: TaskDto, e: KeyboardEvent<HTMLDivElement>) => void;
}

/** A sortable kanban card: drag with the pointer, or focus it and use M / Alt+arrows. */
export const BoardCardItem = memo(function BoardCardItem({ task, columnId, muted, onOpen, onFocusCard, onCardKeyDown }: BoardCardItemProps) {
  const pending = isOptimisticId(task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { columnId }, disabled: pending });
  const row = taskRowProps(task);
  return (
    <BoardCard
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-task-id={task.id}
      id={task.key}
      title={task.title}
      priority={row.priority}
      tags={task.tags.slice(0, 2).map((t) => ({ label: t.name, color: t.color }))}
      due={row.due}
      dueTone={row.dueTone}
      comments={task.commentCount}
      assignee={row.assignee}
      assigneeColor={row.assigneeColor}
      assigneeName={row.assigneeName}
      muted={muted || isDragging}
      aria-roledescription="Task card"
      aria-label={`${task.key} ${task.title}. Press M to move, Enter to open.`}
      aria-busy={pending || undefined}
      tabIndex={0}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : muted ? 0.72 : undefined }}
      onClick={() => !pending && onOpen(task)}
      onFocus={() => onFocusCard(task)}
      onKeyDown={(e) => onCardKeyDown(task, e)}
    />
  );
});
