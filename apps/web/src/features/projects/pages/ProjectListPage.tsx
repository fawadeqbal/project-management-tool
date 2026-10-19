import { useMemo } from 'react';
import { Button, EmptyState, Skeleton } from '@hearth/ui';
import { useUiStore } from '@/shared/layout/ui-store';
import { useTasks } from '@/shared/tasks/queries';
import { TaskList } from '@/shared/tasks/TaskList';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { isTaskStatus } from '@hearth/domain';
import { ProjectFilterBar } from '../components/ProjectFilterBar';
import { applyProjectFilters, useProjectFilters } from '../view-state';
import { useProjectContext } from './ProjectLayout';
import styles from '../projects.module.css';

/** Project list (TaskPanel.dc.html, left side): grouped by status; compact while the panel is open. */
export function ProjectListPage() {
  const { project, projectId } = useProjectContext();
  const { filters } = useProjectFilters(projectId);
  const panel = useTaskPanel();
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const { data: tasks, isLoading } = useTasks({ scope: 'project', projectId, includeDone: true });
  const visible = useMemo(() => applyProjectFilters(tasks ?? [], filters), [tasks, filters]);

  return (
    <>
      <ProjectFilterBar projectId={projectId} members={project.members}>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => openCreateTask({ projectId })}>
          Add task
        </Button>
      </ProjectFilterBar>
      {isLoading ? (
        <div className={styles.listSkeleton} aria-busy="true" aria-label="Loading tasks">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={18} width={`${85 - (i % 3) * 12}%`} />
          ))}
        </div>
      ) : (
        <TaskList
          tasks={visible}
          grouping="status"
          sort="manual"
          label={`${project.name} tasks`}
          compact={!!panel.openKey}
          activeTaskId={visible.find((t) => t.key === panel.openKey)?.id ?? null}
          onOpen={(t) => panel.open(t.key)}
          onAddToGroup={(g) =>
            openCreateTask({ projectId, ...(g.status && isTaskStatus(g.status) ? { status: g.status } : {}) })
          }
          empty={
            <EmptyState
              icon="list"
              title={tasks?.length ? 'No tasks match these filters' : 'No tasks in this project yet'}
              description={tasks?.length ? 'Clear a filter to see more.' : 'Press C to add the first one.'}
              primaryAction={
                <Button icon="plus" onClick={() => openCreateTask({ projectId })}>
                  Add task
                </Button>
              }
            />
          }
        />
      )}
    </>
  );
}
