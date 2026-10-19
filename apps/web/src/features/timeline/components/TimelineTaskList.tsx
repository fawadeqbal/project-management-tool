import { Avatar, Icon, StatusIcon, toUiStatus } from '@hearth/ui';
import type { TimelineRowDto } from '@hearth/contracts';
import { HEADER_HEIGHT, ROW_HEIGHT } from '../timeline-scale';
import styles from '../timeline.module.css';

/** Left side of the Gantt: one row per bar, same height, so the eye tracks across. */
export function TimelineTaskList({ rows, collapsed, onToggleSection, onOpen }: { rows: TimelineRowDto[]; collapsed: Set<string>; onToggleSection: (id: string) => void; onOpen: (key: string) => void }) {
  return (
    <div role="rowgroup" aria-label="Tasks" className={styles.taskList}>
      <div className={styles.taskListHeader} style={{ height: HEADER_HEIGHT }}>
        Task
      </div>
      {rows.map((r) => (
        <div key={r.id} role="row" className={styles.taskRow} data-kind={r.kind} style={{ height: ROW_HEIGHT }}>
          {r.kind === 'section' ? (
            <button type="button" className={styles.sectionToggle} aria-expanded={!collapsed.has(r.id)} onClick={() => onToggleSection(r.id)}>
              <Icon name={collapsed.has(r.id) ? 'chevron-right' : 'chevron-down'} style={{ color: 'var(--text-tertiary)' }} />
              <span className={styles.ellipsis}>{r.name}</span>
            </button>
          ) : r.kind === 'task' ? (
            <button type="button" className={styles.taskName} onClick={() => onOpen(r.key)} title={r.title}>
              <StatusIcon status={toUiStatus(r.status)} label />
              <span className={styles.ellipsis}>{r.title}</span>
              {r.assignee ? <Avatar initials={r.assignee.initials} name={r.assignee.name} color={r.assignee.avatarColor} size={20} /> : null}
            </button>
          ) : (
            <span className={styles.taskName}>
              <span className={styles.diamondSm} aria-hidden="true" />
              <span className={styles.ellipsis}>{r.name}</span>
              <span className={styles.srOnly}>milestone{r.done ? ', done' : ''}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
