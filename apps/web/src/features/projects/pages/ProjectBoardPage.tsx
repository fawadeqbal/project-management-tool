import { useMemo } from 'react';
import { EmptyState, Skeleton } from '@hearth/ui';
import { useTasks } from '@/shared/tasks/queries';
import { ProjectFilterBar } from '../components/ProjectFilterBar';
import { TaskBoard } from '../components/board/TaskBoard';
import { applyProjectFilters, useProjectFilters } from '../view-state';
import { useProjectContext } from './ProjectLayout';
import styles from '../projects.module.css';

export function BoardSkeleton() {
  return (
    <div className={styles.boardSkeleton} aria-busy="true" aria-label="Loading the board">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} width={288} height={360} radius={10} />
      ))}
    </div>
  );
}

/** Project board (Board.dc.html): columns by status with WIP limits, drag and drop, quick add. */
export function ProjectBoardPage() {
  const { project, projectId } = useProjectContext();
  const { filters } = useProjectFilters(projectId);
  const { data: tasks, isLoading, isError } = useTasks({ scope: 'project', projectId, includeDone: true });
  const visible = useMemo(() => applyProjectFilters(tasks ?? [], filters), [tasks, filters]);

  return (
    <>
      <ProjectFilterBar projectId={projectId} members={project.members} swimlanes />
      {isLoading ? (
        <BoardSkeleton />
      ) : isError ? (
        <EmptyState icon="alert" title="We couldn’t load the board" description="Check your connection and try again." />
      ) : (
        <TaskBoard
          tasks={visible}
          label={`${project.name} board`}
          wipLimits={project.wipLimits}
          swimlanes={filters.swimlanes}
          createDefaults={{ projectId }}
        />
      )}
    </>
  );
}
