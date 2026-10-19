import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Button, Card, EmptyState, Skeleton } from '@hearth/ui';
import { usePermission } from '@/shared/auth/use-permission';
import { useMembers, useTeams } from '@/shared/workspace/hooks';
import { useTeamProjects } from '../api';
import { ProjectsTable } from '../components/ProjectsTable';
import { useProjectsUi } from '../projects-ui';
import styles from '../projects.module.css';

/** Team page: who is on the team and the projects it owns. */
export function TeamPage() {
  const { teamId = '' } = useParams();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: members = [] } = useMembers();
  const { data: projects, isLoading } = useTeamProjects(teamId);
  const openCreate = useProjectsUi((s) => s.openCreate);
  const canCreate = usePermission('projects.create');
  const team = teams?.find((t) => t.id === teamId);
  const people = useMemo(() => members.filter((m) => team?.memberIds.includes(m.id)), [members, team]);

  if (!teamsLoading && !team)
    return (
      <div className={styles.page}>
        <EmptyState icon="users" title="We couldn’t find that team" description="It may have been renamed or removed. Pick a team from the sidebar." />
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        {team ? <span className={styles.teamDot} style={{ background: `var(--accent-${team.color}-dot)` }} aria-hidden="true" /> : null}
        <h1 className={styles.title}>{team?.name ?? <Skeleton width={160} height={28} />}</h1>
        <span className={styles.meta}>{team ? `${team.memberIds.length} ${team.memberIds.length === 1 ? 'person' : 'people'}` : ''}</span>
        <span className={styles.grow} />
        <Link to={`/my-tasks?team=${teamId}`} className={styles.textLink}>
          See the team’s tasks
        </Link>
        {canCreate ? (
          <Button icon="plus" onClick={() => openCreate({ teamId })}>
            Create project
          </Button>
        ) : null}
      </div>
      <div className={styles.overview}>
        <div className={styles.overviewMain}>
          <h2 className={styles.sectionTitle}>Projects</h2>
          {isLoading ? (
            <Skeleton height={120} />
          ) : projects?.length ? (
            <ProjectsTable projects={projects} label={`${team?.name ?? 'Team'} projects`} />
          ) : (
            <EmptyState icon="folder" title="No projects for this team yet" description="Create one and pick this team." headingLevel={3} />
          )}
        </div>
        <aside className={styles.overviewSide}>
          <Card padding="lg">
            <h2 className={styles.cardTitle}>Members</h2>
            <ul className={styles.memberList}>
              {people.map((m) => (
                <li key={m.id} className={styles.member}>
                  <Avatar initials={m.initials} name={m.name} color={m.avatarColor} size={24} />
                  <span className={styles.grow}>
                    {m.name}
                    {m.jobTitle ? <span className={styles.projectSub}>{m.jobTitle}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
