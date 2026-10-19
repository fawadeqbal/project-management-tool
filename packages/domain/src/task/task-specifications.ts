import { diffInDays, parseDateOnly } from '../shared/dates';
import { Specification } from '../shared/specification';
import type { FilterableTask } from './task-view';
import { PRIORITY_META, STATUS_META, type Priority, type TaskStatus } from './values';

/** Concrete task rules, composable with and/or/not. Each is one reason to change (SRP). */

export class IsOpen extends Specification<FilterableTask> {
  isSatisfiedBy(t: FilterableTask) {
    return STATUS_META[t.status].isOpen;
  }
  describe() {
    return 'open';
  }
}

export class HasStatus extends Specification<FilterableTask> {
  constructor(private readonly statuses: readonly TaskStatus[]) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    return this.statuses.includes(t.status);
  }
  describe() {
    return `status is ${this.statuses.map((s) => STATUS_META[s].label).join(' or ')}`;
  }
}

export class HasPriority extends Specification<FilterableTask> {
  constructor(private readonly priorities: readonly Priority[]) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    return this.priorities.includes(t.priority);
  }
  describe() {
    return `priority is ${this.priorities.map((p) => PRIORITY_META[p].label).join(' or ')}`;
  }
}

export class AssignedTo extends Specification<FilterableTask> {
  constructor(private readonly userIds: readonly (string | null)[]) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    return this.userIds.includes(t.assigneeId);
  }
  describe() {
    return this.userIds.includes(null) && this.userIds.length === 1
      ? 'unassigned'
      : 'assigned to selected people';
  }
}

export class InProject extends Specification<FilterableTask> {
  constructor(private readonly projectIds: readonly string[]) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    return t.projectId !== null && this.projectIds.includes(t.projectId);
  }
  describe() {
    return 'in selected projects';
  }
}

export class HasTag extends Specification<FilterableTask> {
  constructor(private readonly tagNames: readonly string[]) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    const names = (t.tags ?? []).map((x) => x.name.toLowerCase());
    return this.tagNames.some((n) => names.includes(n.toLowerCase()));
  }
  describe() {
    return `tagged ${this.tagNames.join(', ')}`;
  }
}

export class IsOverdue extends Specification<FilterableTask> {
  constructor(private readonly today: Date) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    return t.status !== 'DONE' && !!t.dueDate && diffInDays(this.today, parseDateOnly(t.dueDate)) < 0;
  }
  describe() {
    return 'overdue';
  }
}

export class DueWithin extends Specification<FilterableTask> {
  /** Due between today+from and today+to days, inclusive. */
  constructor(
    private readonly today: Date,
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }
  isSatisfiedBy(t: FilterableTask) {
    if (!t.dueDate) return false;
    const d = diffInDays(this.today, parseDateOnly(t.dueDate));
    return d >= this.from && d <= this.to;
  }
  describe() {
    return this.from === 0 && this.to === 0 ? 'due today' : `due in ${this.from}–${this.to} days`;
  }
}

export class MatchesText extends Specification<FilterableTask> {
  private readonly needle: string;
  constructor(query: string) {
    super();
    this.needle = query.trim().toLowerCase();
  }
  isSatisfiedBy(t: FilterableTask) {
    if (!this.needle) return true;
    return t.title.toLowerCase().includes(this.needle) || t.key.toLowerCase().includes(this.needle);
  }
  describe() {
    return `matching “${this.needle}”`;
  }
}

/** Serializable filter — what saved views and URLs store. Built into a Specification on demand. */
export interface TaskFilter {
  statuses?: TaskStatus[];
  priorities?: Priority[];
  assigneeIds?: (string | null)[];
  projectIds?: string[];
  tags?: string[];
  overdue?: boolean;
  dueToday?: boolean;
  includeDone?: boolean;
  text?: string;
}

/** Builder: turns a plain filter object into a composed Specification. */
export const buildTaskSpecification = (filter: TaskFilter, today: Date): Specification<FilterableTask> => {
  let spec: Specification<FilterableTask> =
    filter.includeDone || filter.statuses?.includes('DONE') ? new MatchesText('') : new IsOpen();
  if (filter.statuses?.length) spec = spec.and(new HasStatus(filter.statuses));
  if (filter.priorities?.length) spec = spec.and(new HasPriority(filter.priorities));
  if (filter.assigneeIds?.length) spec = spec.and(new AssignedTo(filter.assigneeIds));
  if (filter.projectIds?.length) spec = spec.and(new InProject(filter.projectIds));
  if (filter.tags?.length) spec = spec.and(new HasTag(filter.tags));
  if (filter.overdue) spec = spec.and(new IsOverdue(today));
  if (filter.dueToday) spec = spec.and(new DueWithin(today, 0, 0));
  if (filter.text) spec = spec.and(new MatchesText(filter.text));
  return spec;
};
