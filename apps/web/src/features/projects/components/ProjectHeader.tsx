import { useMemo } from 'react';
import { AvatarGroup, Button, Icon, Skeleton, Tooltip, ViewTabs } from '@hearth/ui';
import type { ProjectDetailDto } from '@hearth/contracts';
import { useToast } from '@/shared/toast';
import { asIcon } from '@/shared/tasks/meta';
import { HealthBadge } from './HealthBadge';
import { dueLine, PROJECT_TABS } from './project-views';
import styles from '../projects.module.css';

export interface ProjectHeaderProps {
  project: ProjectDetailDto | undefined;
  view: string;
  onViewChange: (view: string) => void;
}

const slipDetail = (p: ProjectDetailDto) =>
  p.health.health !== 'ON_TRACK' && p.slip ? `${p.slip.key} slipped ${p.slip.days} ${p.slip.days === 1 ? 'day' : 'days'}` : null;

/** Icon, name, health, "Due Nov 14 · 62% complete", people (max 4 then +N), Share, and the view tabs. */
export function ProjectHeader({ project, view, onViewChange }: ProjectHeaderProps) {
  const { show } = useToast();
  const people = useMemo(() => (project?.members ?? []).map((m) => ({ initials: m.initials, name: m.name, color: m.avatarColor })), [project]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split('?')[0]!);
      show({ message: 'Link copied — anyone with access to this project can open it', icon: 'link', tone: 'info' });
    } catch {
      show({ message: 'We couldn’t copy the link. Copy it from the address bar instead.', tone: 'danger', icon: 'alert' });
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        {project ? (
          <>
            <span className={styles.projectIcon} style={{ background: `var(--accent-${project.color}-avatar)`, color: `var(--accent-${project.color}-fg)` }}>
              <Icon name={asIcon(project.icon, 'folder')} />
            </span>
            <h1 className={styles.title}>{project.name}</h1>
            <HealthBadge health={project.health} detail={slipDetail(project)} />
            <span className={styles.meta}>{dueLine(project.dueDate, project.progress)}</span>
          </>
        ) : (
          <Skeleton width={320} height={32} />
        )}
        <span className={styles.grow} />
        {people.length ? (
          <Tooltip content={people.map((p) => p.name).join(', ')}>
            <span tabIndex={0} className={styles.people} aria-label={`People: ${people.map((p) => p.name).join(', ')}`}>
              <AvatarGroup people={people} max={4} size={28} />
            </span>
          </Tooltip>
        ) : null}
        <Button variant="secondary" icon="link" onClick={() => void share()}>
          Share
        </Button>
      </div>
      <ViewTabs tabs={PROJECT_TABS} value={view} onChange={onViewChange} label="Project views" />
    </header>
  );
}
