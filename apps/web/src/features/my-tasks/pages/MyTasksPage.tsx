import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Skeleton, ViewTabs, type ViewTab } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { buildTaskSpecification, type FilterableTask } from '@hearth/domain';
import { firstName, useMe } from '@/shared/auth/use-me';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useUiStore } from '@/shared/layout/ui-store';
import { greetingFor, longToday, today } from '@/shared/tasks/dates';
import { useTasks } from '@/shared/tasks/queries';
import { TaskList } from '@/shared/tasks/TaskList';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { useShell, useTeams } from '@/shared/workspace/hooks';
import { FilterPopover } from '../components/FilterPopover';
import { MyTasksEmpty, NoMatches } from '../components/MyTasksEmpty';
import { QuickAddRow } from '../components/QuickAddRow';
import { UrlFilterSummary } from '../components/UrlFilterSummary';
import { ViewControls } from '../components/ViewControls';
import { hasUrlFilters, toTaskFilter, useMyTasksView } from '../view-state';
import styles from '../my-tasks.module.css';

export const MY_TASKS_TABS: ViewTab[] = [
  { id: 'list', label: 'List', icon: 'list' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-view' },
];
const TAB_PATHS: Record<string, string> = {
  list: '/my-tasks',
  board: '/my-tasks/board',
  calendar: '/my-tasks/calendar',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Monday, October 19 · 3 tasks due today · 1 overdue" */
export function summaryLine(tasks: readonly FilterableTask[], now = new Date()): string {
  const t = today(now);
  const dueToday = tasks.filter((x) => buildTaskSpecification({ dueToday: true }, t).isSatisfiedBy(x)).length;
  const overdue = tasks.filter((x) => buildTaskSpecification({ overdue: true }, t).isSatisfiedBy(x)).length;
  const parts = [longToday(now)];
  parts.push(dueToday ? `${plural(dueToday, 'task')} due today` : 'Nothing due today');
  if (overdue) parts.push(`${overdue} overdue`);
  return parts.join(' · ');
}

function ListSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Loading your tasks">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} height={18} width={`${85 - (i % 3) * 12}%`} />
      ))}
    </div>
  );
}

export function MyTasksPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: shell } = useShell();
  const { data: teams } = useTeams();
  const { view, setView, resetView, url, clearUrlFilters, activeFilterCount } = useMyTasksView();
  const panel = useTaskPanel();
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const { quickAdd } = useTaskMutations();
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Team / other-person filters look beyond "mine".
  const teamMemberIds = useMemo(
    () => (url.teamId ? (teams?.find((t) => t.id === url.teamId)?.memberIds ?? []) : null),
    [url.teamId, teams],
  );
  const wide = !!url.assigneeId || !!url.teamId;
  const query = useMemo(
    () =>
      wide
        ? {
            scope: 'workspace' as const,
            includeDone: view.includeDone || undefined,
            assigneeIds:
              url.assigneeId && url.assigneeId !== 'none' ? [url.assigneeId] : (teamMemberIds ?? undefined),
          }
        : { scope: 'mine' as const, includeDone: view.includeDone || undefined },
    [wide, view.includeDone, url.assigneeId, teamMemberIds],
  );
  const { data: tasks, isLoading, isError, refetch } = useTasks(query);

  // Tasks completed here stay visible (struck through) until you leave, so Undo has context.
  const [recentlyDone, setRecentlyDone] = useState<Map<string, TaskDto>>(new Map());
  const onCompleted = useCallback(
    (task: TaskDto) => setRecentlyDone((m) => new Map(m).set(task.id, task)),
    [],
  );

  const all = useMemo(() => {
    const list = tasks ?? [];
    const ids = new Set(list.map((t) => t.id));
    const extra = [...recentlyDone.values()]
      .filter((t) => !ids.has(t.id))
      .map((t) => ({ ...t, status: 'DONE' as const }));
    return [...list, ...extra];
  }, [tasks, recentlyDone]);

  const visible = useMemo(() => {
    const spec = buildTaskSpecification(toTaskFilter(view, url, teamMemberIds), today());
    return all.filter((t) => recentlyDone.has(t.id) || spec.isSatisfiedBy(t));
  }, [all, view, url, teamMemberIds, recentlyDone]);

  const projectNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const t of all) if (t.project) names[t.project.id] = t.project.name;
    for (const p of shell?.favorites ?? []) names[p.id] = p.name;
    return names;
  }, [all, shell]);
  const projects = useMemo(
    () =>
      Object.entries(projectNames).map(([id, name]) => ({
        id,
        name,
        color: shell?.favorites.find((f) => f.id === id)?.color ?? ('slate' as const),
      })),
    [projectNames, shell],
  );

  useHotkey('C', () => quickAddRef.current?.focus(), { enabled: !isLoading });
  useHotkey('1', () => void navigate(TAB_PATHS.list!));
  useHotkey('2', () => void navigate(TAB_PATHS.board!));
  useHotkey('3', () => void navigate(TAB_PATHS.calendar!));

  const greeting = `${greetingFor()}, ${firstName(me?.user.name) || 'there'}`;
  const filtered = activeFilterCount > 0 || hasUrlFilters(url);
  const quickAddRow = (
    <QuickAddRow ref={quickAddRef} onSubmit={(text) => quickAdd({ text, assignToMe: true })} />
  );

  let content;
  if (isLoading) content = <ListSkeleton />;
  else if (isError)
    content = (
      <EmptyState
        icon="alert"
        title="We couldn’t load your tasks"
        description="Check your connection and try again. Nothing you’ve done is lost."
        primaryAction={
          <Button variant="secondary" icon="undo" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  else if (all.length === 0 && !filtered)
    content = (
      <TaskList
        tasks={[]}
        label="My tasks"
        onOpen={() => undefined}
        empty={<MyTasksEmpty onCreate={() => openCreateTask()} />}
        footer={quickAddRow}
      />
    );
  else
    content = (
      <TaskList
        tasks={visible}
        grouping={view.grouping}
        sort={view.sort}
        label="My tasks"
        activeTaskId={all.find((t) => t.key === panel.openKey)?.id ?? null}
        onOpen={(t) => panel.open(t.key)}
        onCompleted={onCompleted}
        projectNames={projectNames}
        hideAssignee={!wide}
        empty={
          <NoMatches
            onClear={() => {
              resetView();
              clearUrlFilters();
            }}
          />
        }
        onAddToGroup={(g) =>
          openCreateTask(g.id === 'today' ? { dueDate: today().toISOString().slice(0, 10) } : {})
        }
        footer={quickAddRow}
      />
    );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{greeting}</h1>
          <p className={styles.summary}>{summaryLine(tasks ?? [])}</p>
        </div>
        <ViewTabs
          tabs={MY_TASKS_TABS}
          value="list"
          label="My tasks views"
          onChange={(id) => void navigate(TAB_PATHS[id] ?? '/my-tasks')}
        />
      </div>

      <div className={styles.toolbar}>
        <FilterPopover
          view={view}
          onChange={setView}
          onReset={resetView}
          activeCount={activeFilterCount}
          projects={projects}
        />
        <ViewControls view={view} onChange={setView} />
        {hasUrlFilters(url) ? (
          <Button variant="ghost" size="sm" icon="x" onClick={clearUrlFilters}>
            Clear search filters
          </Button>
        ) : null}
        <span className={styles.grow} />
        <span className={styles.savedView}>Saved view · “My focus”</span>
        <Button variant="secondary" icon="plus" className={styles.hidePhone} onClick={() => openCreateTask()}>
          Add task
        </Button>
      </div>

      {hasUrlFilters(url) ? <UrlFilterSummary filters={url} projectNames={projectNames} /> : null}
      {content}
    </div>
  );
}
