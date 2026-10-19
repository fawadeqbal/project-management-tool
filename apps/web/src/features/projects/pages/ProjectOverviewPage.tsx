import { useState } from 'react';
import { Avatar, Button, Card, Icon, ProgressBar, Textarea } from '@hearth/ui';
import type { ProjectHealthDto } from '@hearth/contracts';
import { formatShortDate, HEALTH_META, parseDateOnly, PROJECT_HEALTH } from '@hearth/domain';
import { usePermission } from '@/shared/auth/use-permission';
import { useToast } from '@/shared/toast';
import { asIcon } from '@/shared/tasks/meta';
import { useUpdateProject } from '../api';
import { HealthBadge } from '../components/HealthBadge';
import { useProjectContext } from './ProjectLayout';
import styles from '../projects.module.css';

const date = (d: string | null) => (d ? formatShortDate(parseDateOnly(d)) : '—');

/** Overview: description, health (suggestion + override), progress, milestones and members. */
export function ProjectOverviewPage() {
  const { project, projectId } = useProjectContext();
  const canManage = usePermission('projects.manage');
  const update = useUpdateProject(projectId);
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.description ?? '');

  const setHealth = (health: ProjectHealthDto) => {
    const previous = project.health.health;
    if (health === previous) return;
    update.mutate({ health });
    show({
      message: `Health set to ${HEALTH_META[health].label}`,
      action: 'Undo',
      onAction: () => update.mutate({ health: previous }),
    });
  };

  const saveDescription = () => {
    setEditing(false);
    if ((project.description ?? '') !== draft.trim()) update.mutate({ description: draft.trim() || null });
  };

  const suggestionDiffers = project.suggestedHealth.health !== project.health.health;

  return (
    <div className={styles.overview}>
      <div className={styles.overviewMain}>
        <Card padding="lg">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>About</h2>
            {canManage && !editing ? (
              <Button variant="ghost" size="sm" icon="pencil" onClick={() => (setDraft(project.description ?? ''), setEditing(true))}>
                Edit
              </Button>
            ) : null}
          </div>
          {editing ? (
            <div className={styles.descEdit}>
              <Textarea label="Description" hideLabel rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className={styles.row}>
                <Button size="sm" onClick={saveDescription}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.description}>{project.description || 'No description yet. Say what this project is for and what done looks like.'}</p>
          )}
          <dl className={styles.facts}>
            <div>
              <dt>Owner</dt>
              <dd>
                <Avatar initials={project.owner.initials} name={project.owner.name} color={project.owner.avatarColor} size={20} /> {project.owner.name}
              </dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{project.team?.name ?? 'No team'}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{date(project.startDate)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{date(project.dueDate)}</dd>
            </div>
          </dl>
        </Card>

        <Card padding="lg">
          <h2 className={styles.cardTitle}>Health</h2>
          <div className={styles.healthRow}>
            <HealthBadge health={project.health} />
            <span className={styles.muted}>{project.suggestedHealth.reason}</span>
          </div>
          {suggestionDiffers ? (
            <p className={styles.suggestion}>
              <Icon name="sparkles" /> The schedule suggests <strong>{project.suggestedHealth.label}</strong>.{' '}
              {canManage ? (
                <button type="button" className={styles.linkButton} onClick={() => setHealth(project.suggestedHealth.health)}>
                  Use suggestion
                </button>
              ) : null}
            </p>
          ) : null}
          {canManage ? (
            <div className={styles.healthPicker} role="radiogroup" aria-label="Set project health">
              {PROJECT_HEALTH.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={project.health.health === h} className={styles.healthOption} data-tone={HEALTH_META[h].tone} onClick={() => setHealth(h)}>
                  <Icon name={asIcon(HEALTH_META[h].icon)} />
                  {HEALTH_META[h].label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.progressBlock}>
            <div className={styles.row}>
              <span className={styles.cardLabel}>Progress</span>
              <span className={styles.grow} />
              <span className={styles.muted}>
                {project.counts.done} of {project.counts.total} tasks · {project.progress}%
              </span>
            </div>
            <ProgressBar value={project.progress} label="Project progress" tone={project.progress === 100 ? 'success' : 'brand'} />
            <div className={styles.countRow}>
              <span>{project.counts.open} open</span>
              <span data-tone={project.counts.overdue ? 'danger' : undefined}>{project.counts.overdue} overdue</span>
              <span>{project.counts.blocked} blocked</span>
            </div>
          </div>
        </Card>
      </div>

      <aside className={styles.overviewSide}>
        <Card padding="lg">
          <h2 className={styles.cardTitle}>Milestones</h2>
          {project.milestones.length ? (
            <ul className={styles.milestones}>
              {project.milestones.map((m) => (
                <li key={m.id} className={styles.milestone} data-done={m.done || undefined}>
                  <span className={styles.diamond} aria-hidden="true" />
                  <span className={styles.grow}>{m.name}</span>
                  <span className={styles.muted}>{m.done ? 'Done' : date(m.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No milestones yet. Add them on the Timeline.</p>
          )}
        </Card>
        <Card padding="lg">
          <h2 className={styles.cardTitle}>People</h2>
          <ul className={styles.memberList}>
            {project.members.map((m) => (
              <li key={m.id} className={styles.member}>
                <Avatar initials={m.initials} name={m.name} color={m.avatarColor} size={24} />
                <span className={styles.grow}>
                  {m.name}
                  {m.isOwner ? <span className={styles.muted}> · Owner</span> : null}
                </span>
                <span className={styles.muted}>{m.openTasks ? `${m.openTasks} open` : '—'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
