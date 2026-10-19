import { PRIORITY_META, STATUS_META } from '@hearth/domain';
import { useMemberMap, useShell, useTeams } from '@/shared/workspace/hooks';
import type { UrlFilters } from '../view-state';
import styles from '../my-tasks.module.css';

/** "Showing overdue tasks tagged Design" — explains filters that came from the URL (⌘K, sidebar). */
export function UrlFilterSummary({ filters, projectNames }: { filters: UrlFilters; projectNames: Record<string, string> }) {
  const members = useMemberMap();
  const { data: teams } = useTeams();
  const { data: shell } = useShell();
  const parts: string[] = [];
  const head: string[] = [];
  if (filters.overdue) head.push('overdue');
  if (filters.priority) head.push(PRIORITY_META[filters.priority].label.toLowerCase());
  if (filters.status) head.push(STATUS_META[filters.status].label.toLowerCase());
  parts.push(`Showing ${head.length ? `${head.join(', ')} ` : ''}tasks`);
  if (filters.teamId) parts.push(`for the ${teams?.find((t) => t.id === filters.teamId)?.name ?? 'selected'} team`);
  if (filters.tag) parts.push(`tagged ${filters.tag}`);
  if (filters.projectId) parts.push(`in ${projectNames[filters.projectId] ?? shell?.favorites.find((p) => p.id === filters.projectId)?.name ?? 'the selected project'}`);
  if (filters.assigneeId === 'none') parts.push('that are unassigned');
  else if (filters.assigneeId) parts.push(`assigned to ${members.get(filters.assigneeId)?.name ?? 'a teammate'}`);
  if (filters.dueToday) parts.push('due today');
  if (filters.q) parts.push(`matching “${filters.q}”`);
  return (
    <p className={styles.urlFilters} role="status">
      {parts.join(' ')}
    </p>
  );
}
