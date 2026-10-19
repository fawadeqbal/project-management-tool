import type { Priority, TaskStatus } from './values';

/**
 * The read-side shape every task filter, grouping and sort works on. It is deliberately
 * minimal (Interface Segregation): API DTOs and web view models both satisfy it.
 */
export interface FilterableTask {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  projectId: string | null;
  /** "YYYY-MM-DD" calendar date or null. */
  dueDate: string | null;
  tags?: readonly { name: string }[];
  createdAt?: string;
  listPosition?: number;
}
