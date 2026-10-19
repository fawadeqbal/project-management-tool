import { useMemo } from 'react';
import { applyProjectFilters, ProjectFilterBar, useProjectContext, useProjectFilters } from '@/features/projects';
import { useTasks } from '@/shared/tasks/queries';
import { TaskCalendar } from '../components/TaskCalendar';
import { useCalendarState } from '../use-calendar-state';

/** Project calendar: this project's tasks by due date, plus its unscheduled work. */
export function ProjectCalendarPage() {
  const { project, projectId } = useProjectContext();
  const { filters } = useProjectFilters(projectId);
  const { cursor, range, window, setCursor, setRange } = useCalendarState();
  const { data: scheduled = [] } = useTasks({ scope: 'project', projectId, includeDone: true, from: window.from, to: window.to });
  const { data: all = [] } = useTasks({ scope: 'project', projectId });
  const unscheduled = useMemo(() => applyProjectFilters(all.filter((t) => !t.dueDate && t.status !== 'DONE'), filters), [all, filters]);
  const visible = useMemo(() => applyProjectFilters(scheduled, filters), [scheduled, filters]);
  return (
    <>
      <ProjectFilterBar projectId={projectId} members={project.members} />
      <TaskCalendar scheduled={visible} unscheduled={unscheduled} cursor={cursor} range={range} onCursorChange={setCursor} onRangeChange={setRange} label={`${project.name} calendar`} />
    </>
  );
}
