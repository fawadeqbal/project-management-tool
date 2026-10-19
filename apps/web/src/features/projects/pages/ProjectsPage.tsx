import { Button, EmptyState, Kbd, Skeleton } from '@hearth/ui';
import { usePermission } from '@/shared/auth/use-permission';
import { useProjects } from '../api';
import { ProjectsTable } from '../components/ProjectsTable';
import { useProjectsUi } from '../projects-ui';
import styles from '../projects.module.css';

/** Projects index: every project you can see, with health, owner, progress, due date and favorites. */
export function ProjectsPage() {
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const openCreate = useProjectsUi((s) => s.openCreate);
  const canCreate = usePermission('projects.create');

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Projects</h1>
        <span className={styles.meta}>
          {projects ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}` : ''}
        </span>
        <span className={styles.grow} />
        {canCreate ? (
          <Button icon="plus" onClick={() => openCreate()}>
            Create project
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className={styles.listSkeleton} aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={44} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon="alert"
          title="We couldn’t load your projects"
          description="Check your connection and try again."
          primaryAction={
            <Button variant="secondary" icon="undo" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : projects?.length ? (
        <ProjectsTable projects={projects} label="Projects" />
      ) : (
        <EmptyState
          icon="folder"
          title="No projects yet"
          description={
            <>
              Group related tasks, set a due date and track health in one place. Press{' '}
              <Kbd keys={['Mod', 'K']} /> and type “Create project”.
            </>
          }
          primaryAction={
            canCreate ? (
              <Button icon="plus" onClick={() => openCreate()}>
                Create project
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
