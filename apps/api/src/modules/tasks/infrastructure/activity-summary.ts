import { formatShortDate, parseDateOnly, PRIORITY_META, STATUS_META, isPriority, isTaskStatus } from '@hearth/domain';

/**
 * Renders one activity row as a sentence in the Hearth voice ("changed status to In review").
 * `userName` resolves user ids found in payloads (task.assigned stores the assignee id).
 */
export const activitySummary = (type: string, payload: Record<string, unknown>, userName: (id: string) => string | undefined): string => {
  switch (type) {
    case 'task.created':
      return 'created this task';
    case 'task.status_changed':
      return isTaskStatus(payload['to']) ? `changed status to ${STATUS_META[payload['to']].label}` : 'changed the status';
    case 'task.assigned': {
      const to = payload['to'];
      if (typeof to !== 'string' || !to) return 'unassigned this';
      return `assigned this to ${userName(to) ?? to}`;
    }
    case 'task.priority_changed':
      return isPriority(payload['to']) ? `changed priority to ${PRIORITY_META[payload['to']].label}` : 'changed the priority';
    case 'task.rescheduled': {
      const due = payload['dueDate'];
      const start = payload['startDate'];
      if (typeof due === 'string') return `rescheduled to ${formatShortDate(parseDateOnly(due))}`;
      if (typeof start === 'string') return `rescheduled to start ${formatShortDate(parseDateOnly(start))}`;
      return 'removed the dates';
    }
    case 'task.renamed':
      return 'renamed this task';
    case 'comment.created':
      return 'commented';
    case 'task.moved':
      return payload['fromProjectId'] !== payload['toProjectId'] ? 'moved this to another project' : 'moved this task';
    default:
      return 'updated this task';
  }
};

/** Activity rows that are noise in the feed (drag-to-reorder) — still broadcast, never listed. */
export const isHiddenActivity = (type: string, payload: Record<string, unknown>): boolean => {
  const fields = payload['fields'];
  return type === 'task.updated' && Array.isArray(fields) && fields.length > 0 && fields.every((f) => f === 'position');
};
