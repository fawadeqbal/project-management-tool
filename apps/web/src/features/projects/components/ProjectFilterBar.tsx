import { useMemo, type ReactNode } from 'react';
import { Button, DropdownMenu, type DropdownMenuSection } from '@hearth/ui';
import type { ProjectMemberDto } from '@hearth/contracts';
import {
  PRIORITIES,
  PRIORITY_META,
  STATUS_META,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from '@hearth/domain';
import { STATUS_ICON } from '@/shared/tasks/meta';
import { useProjectFilters, type Swimlanes } from '../view-state';
import styles from '../projects.module.css';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const SWIMLANES: { id: Swimlanes; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
];

export interface ProjectFilterBarProps {
  projectId: string;
  members: readonly ProjectMemberDto[];
  /** Board only: offer swimlanes. */
  swimlanes?: boolean;
  children?: ReactNode;
}

/** Filter · Assignee · Swimlanes — shared by every project view and remembered per project. */
export function ProjectFilterBar({ projectId, members, swimlanes = false, children }: ProjectFilterBarProps) {
  const { filters, setFilters, activeCount } = useProjectFilters(projectId);

  const filterItems = useMemo<DropdownMenuSection[]>(
    () => [
      {
        id: 'status',
        heading: 'Status',
        items: TASK_STATUSES.map((s: TaskStatus) => ({
          id: `s-${s}`,
          label: STATUS_META[s].label,
          icon: filters.statuses.includes(s) ? 'check' : STATUS_ICON[s].icon,
          iconColor: filters.statuses.includes(s) ? 'var(--brand-primary)' : STATUS_ICON[s].color,
          onSelect: () => setFilters({ statuses: toggle(filters.statuses, s) }),
        })),
      },
      {
        id: 'priority',
        heading: 'Priority',
        items: PRIORITIES.map((p: Priority) => ({
          id: `p-${p}`,
          label: PRIORITY_META[p].label,
          icon: filters.priorities.includes(p) ? 'check' : 'flag',
          onSelect: () => setFilters({ priorities: toggle(filters.priorities, p) }),
        })),
      },
      ...(activeCount
        ? [
            {
              id: 'clear',
              items: [
                {
                  id: 'clear',
                  label: 'Clear filters',
                  icon: 'x' as const,
                  onSelect: () => setFilters({ statuses: [], priorities: [], assigneeId: null }),
                },
              ],
            },
          ]
        : []),
    ],
    [filters, setFilters, activeCount],
  );

  const assigneeLabel =
    filters.assigneeId === null
      ? 'Anyone'
      : filters.assigneeId === 'none'
        ? 'No one'
        : (members.find((m) => m.id === filters.assigneeId)?.name.split(' ')[0] ?? 'Someone');
  const assigneeItems = useMemo(
    () => [
      {
        id: 'anyone',
        label: 'Anyone',
        icon: filters.assigneeId === null ? ('check' as const) : ('users' as const),
        onSelect: () => setFilters({ assigneeId: null }),
      },
      {
        id: 'none',
        label: 'No one',
        icon: filters.assigneeId === 'none' ? ('check' as const) : ('user-plus' as const),
        onSelect: () => setFilters({ assigneeId: 'none' }),
      },
      ...members.map((m) => ({
        id: m.id,
        label: m.name,
        hint: m.openTasks ? `${m.openTasks} open` : undefined,
        icon: filters.assigneeId === m.id ? ('check' as const) : ('user-plus' as const),
        onSelect: () => setFilters({ assigneeId: m.id }),
      })),
    ],
    [members, filters.assigneeId, setFilters],
  );

  return (
    <div className={styles.filterBar} role="toolbar" aria-label="Filters">
      {children}
      <span className={styles.grow} />
      <DropdownMenu
        label="Filter tasks"
        align="end"
        items={filterItems}
        trigger={
          <Button variant="secondary" size="sm" icon="filter">
            {activeCount ? `Filter · ${activeCount}` : 'Filter'}
          </Button>
        }
      />
      <DropdownMenu
        label="Assignee"
        align="end"
        items={assigneeItems}
        trigger={
          <Button variant="secondary" size="sm" icon="users">
            Assignee: {assigneeLabel}
          </Button>
        }
      />
      {swimlanes ? (
        <DropdownMenu
          label="Swimlanes"
          align="end"
          items={SWIMLANES.map((s) => ({
            id: s.id,
            label: s.label,
            icon: filters.swimlanes === s.id ? 'check' : 'list',
            onSelect: () => setFilters({ swimlanes: s.id }),
          }))}
          trigger={
            <Button variant="secondary" size="sm" icon="list">
              Swimlanes: {SWIMLANES.find((s) => s.id === filters.swimlanes)?.label}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
