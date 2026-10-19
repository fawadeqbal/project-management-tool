import { toUiPriority, toUiStatus, type TaskRowProps } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { dueInfo } from './dates';

/** Maps a TaskDto to the design system's TaskRow/BoardCard display props. */
export function taskRowProps(
  task: TaskDto,
  now?: Date,
): Pick<
  TaskRowProps,
  | 'id'
  | 'title'
  | 'priority'
  | 'status'
  | 'tag'
  | 'tagColor'
  | 'due'
  | 'dueTone'
  | 'assignee'
  | 'assigneeColor'
  | 'assigneeName'
  | 'done'
> {
  const done = task.status === 'DONE';
  const due = dueInfo(task.dueDate, { done, now });
  const tag = task.tags[0];
  return {
    id: task.key,
    title: task.title,
    priority: toUiPriority(task.priority),
    status: toUiStatus(task.status),
    tag: tag?.name,
    tagColor: tag?.color,
    due: due?.label,
    dueTone: due?.tone,
    assignee: task.assignee?.initials,
    assigneeColor: task.assignee?.avatarColor,
    assigneeName: task.assignee?.name,
    done,
  };
}
