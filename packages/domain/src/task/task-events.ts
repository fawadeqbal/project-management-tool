import type { DomainEvent } from '../shared/domain-event';
import type { Priority, TaskStatus } from './values';

export type TaskCreated = DomainEvent<'task.created', { key: string; title: string; projectId: string | null; assigneeId: string | null }>;
export type TaskStatusChanged = DomainEvent<'task.status_changed', { key: string; title: string; from: TaskStatus; to: TaskStatus; projectId: string | null }>;
export type TaskAssigned = DomainEvent<'task.assigned', { key: string; title: string; from: string | null; to: string | null; projectId: string | null }>;
export type TaskRescheduled = DomainEvent<'task.rescheduled', { key: string; startDate: string | null; dueDate: string | null; projectId: string | null }>;
export type TaskPriorityChanged = DomainEvent<'task.priority_changed', { key: string; from: Priority; to: Priority; projectId: string | null }>;
export type TaskRenamed = DomainEvent<'task.renamed', { key: string; from: string; to: string; projectId: string | null }>;
export type TaskUpdated = DomainEvent<'task.updated', { key: string; fields: string[]; projectId: string | null }>;
export type TaskMoved = DomainEvent<'task.moved', { key: string; fromProjectId: string | null; toProjectId: string | null }>;
export type TaskDeleted = DomainEvent<'task.deleted', { key: string; title: string; projectId: string | null }>;

export type TaskEvent =
  | TaskCreated
  | TaskStatusChanged
  | TaskAssigned
  | TaskRescheduled
  | TaskPriorityChanged
  | TaskRenamed
  | TaskUpdated
  | TaskMoved
  | TaskDeleted;

/** Other bounded contexts publish their own events; this is the catalog of task event names. */
export const TASK_EVENT_TYPES = [
  'task.created',
  'task.status_changed',
  'task.assigned',
  'task.rescheduled',
  'task.priority_changed',
  'task.renamed',
  'task.updated',
  'task.moved',
  'task.deleted',
] as const;
