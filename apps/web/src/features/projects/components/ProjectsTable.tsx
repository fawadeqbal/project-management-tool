import { Link } from 'react-router-dom';
import { Avatar, Button, Icon, ProgressBar } from '@hearth/ui';
import type { ProjectSummaryDto } from '@hearth/contracts';
import { formatShortDate, parseDateOnly } from '@hearth/domain';
import { asIcon } from '@/shared/tasks/meta';
import { useToggleFavorite } from '../api';
import { HealthBadge } from './HealthBadge';
import styles from '../projects.module.css';

/** Projects with health, owner, progress, due date and a favorite star. */
export function ProjectsTable({ projects, label }: { projects: readonly ProjectSummaryDto[]; label: string }) {
  const toggleFavorite = useToggleFavorite();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col" className={styles.starCol}>
              <span className={styles.srOnly}>Favorite</span>
            </th>
            <th scope="col">Project</th>
            <th scope="col">Health</th>
            <th scope="col" className={styles.hideNarrow}>
              Owner
            </th>
            <th scope="col">Progress</th>
            <th scope="col" className={styles.hideNarrow}>
              Due
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td className={styles.starCol}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="star"
                  aria-pressed={p.isFavorite}
                  aria-label={p.isFavorite ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
                  className={p.isFavorite ? styles.starOn : styles.starOff}
                  onClick={() => toggleFavorite(p, !p.isFavorite)}
                />
              </td>
              <td>
                <Link to={`/projects/${p.id}/board`} className={styles.projectLink}>
                  <span className={styles.projectIconSm} style={{ background: `var(--accent-${p.color}-avatar)`, color: `var(--accent-${p.color}-fg)` }}>
                    <Icon name={asIcon(p.icon, 'folder')} size={14} />
                  </span>
                  <span>
                    <span className={styles.projectName}>{p.name}</span>
                    <span className={styles.projectSub}>
                      {p.team ? `${p.team.name} · ` : ''}
                      {p.counts.open} open{p.counts.overdue ? ` · ${p.counts.overdue} overdue` : ''}
                    </span>
                  </span>
                </Link>
              </td>
              <td>
                <HealthBadge health={p.health} />
              </td>
              <td className={styles.hideNarrow}>
                <span className={styles.owner}>
                  <Avatar initials={p.owner.initials} name={p.owner.name} color={p.owner.avatarColor} size={20} />
                  {p.owner.name}
                </span>
              </td>
              <td>
                <span className={styles.progressCell}>
                  <ProgressBar value={p.progress} label={`${p.name} progress`} tone={p.progress === 100 ? 'success' : 'brand'} />
                  <span className={styles.muted}>{p.progress}%</span>
                </span>
              </td>
              <td className={styles.hideNarrow}>{p.dueDate ? formatShortDate(parseDateOnly(p.dueDate)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
