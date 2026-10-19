import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectHealthRowDto } from '@hearth/contracts';
import { formatShortDate, parseDateOnly } from '@hearth/domain';
import { Avatar, Icon, isIconName, ProgressBar, Tooltip } from '@hearth/ui';
import { sortHealthRows, type HealthSort, type HealthSortKey } from '../health-sort';
import styles from '../dashboard.module.css';

const COLUMNS: { key: HealthSortKey; label: string }[] = [
  { key: 'project', label: 'Project' },
  { key: 'health', label: 'Health' },
  { key: 'owner', label: 'Owner' },
  { key: 'progress', label: 'Progress' },
  { key: 'due', label: 'Due' },
  { key: 'budget', label: 'Budget used' },
];

const TONE_CLASS = {
  success: styles.healthSuccess,
  warning: styles.healthWarning,
  danger: styles.healthDanger,
};

/** Project health: icon + label + color, sortable column headers (aria-sort), rows link to projects. */
export function ProjectHealthTable({ rows }: { rows: ProjectHealthRowDto[] }) {
  const [sort, setSort] = useState<HealthSort | null>(null);
  const sorted = useMemo(() => sortHealthRows(rows, sort), [rows, sort]);
  const toggle = (key: HealthSortKey) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  return (
    <section aria-labelledby="health-h" className={styles.tableCard}>
      <h2 id="health-h" className={styles.srOnly}>
        Project health
      </h2>
      {!rows.length ? (
        <p className={styles.muted} style={{ padding: 'var(--space-6)' }}>
          No projects yet. Start one from a template on Home and it shows up here.
        </p>
      ) : (
        <div role="table" aria-labelledby="health-h" className={styles.table}>
          <div role="rowgroup">
            <div role="row" className={`${styles.healthRow} ${styles.healthHead}`}>
              {COLUMNS.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <span
                    key={c.key}
                    role="columnheader"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className={styles.sortButton} onClick={() => toggle(c.key)}>
                      {c.label}
                      <Icon
                        name="chevron-down"
                        size={12}
                        className={`${styles.sortIcon} ${active ? styles.sortActive : ''} ${active && sort.dir === 'asc' ? styles.sortAsc : ''}`}
                      />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <div role="rowgroup">
            {sorted.map((r) => (
              <div key={r.project.id} role="row" className={styles.healthRow}>
                <span role="cell" className={styles.projectCell}>
                  <span
                    className={styles.dot}
                    style={{ background: `var(--accent-${r.project.color}-dot)` }}
                    aria-hidden="true"
                  />
                  <Link to={`/projects/${r.project.id}`} className={styles.projectLink}>
                    {r.project.name}
                  </Link>
                </span>
                <span role="cell">
                  <Tooltip
                    content={
                      r.suggestedHealth !== r.health ? `Suggested: ${r.suggestedReason}` : r.suggestedReason
                    }
                  >
                    <span tabIndex={0} className={`${styles.healthBadge} ${TONE_CLASS[r.healthMeta.tone]}`}>
                      {isIconName(r.healthMeta.icon) ? <Icon name={r.healthMeta.icon} size={12} /> : null}
                      {r.healthMeta.label}
                    </span>
                  </Tooltip>
                </span>
                <span role="cell" className={styles.ownerCell}>
                  <Avatar
                    initials={r.owner.initials}
                    name={r.owner.name}
                    color={r.owner.avatarColor}
                    size={24}
                  />
                  {r.owner.name.split(' ')[0]}
                </span>
                <span role="cell" className={styles.progressCell}>
                  <span className={styles.grow}>
                    <ProgressBar value={r.progress} label={`${r.project.name} progress`} />
                  </span>
                  <span className={styles.pct}>{r.progress}%</span>
                </span>
                <span role="cell" className={styles.secondary}>
                  {r.due ? formatShortDate(parseDateOnly(r.due)) : 'No date'}
                </span>
                <span role="cell" className={r.budgetTone === 'danger' ? styles.budgetDanger : styles.budget}>
                  {r.budgetUsedPct === null ? '—' : `${r.budgetUsedPct}%`}
                  {r.budgetTone === 'danger' ? (
                    <Icon name="alert" size={12} label="Over budget pace" />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
