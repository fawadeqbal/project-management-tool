import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ViewTabs } from '@hearth/ui';
import { MY_TASKS_TABS } from '@/features/my-tasks';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useTasks } from '@/shared/tasks/queries';
import { TaskCalendar } from '../components/TaskCalendar';
import { useCalendarState } from '../use-calendar-state';
import styles from '../calendar.module.css';

const PATHS: Record<string, string> = {
  list: '/my-tasks',
  board: '/my-tasks/board',
  calendar: '/my-tasks/calendar',
};

/** My tasks calendar: everything assigned to me by due date, across projects (legend by project). */
export function MyTasksCalendarPage() {
  const navigate = useNavigate();
  const { cursor, range, window, setCursor, setRange } = useCalendarState();
  const { data: scheduled = [] } = useTasks({
    scope: 'mine',
    includeDone: true,
    from: window.from,
    to: window.to,
  });
  const { data: mine = [] } = useTasks({ scope: 'mine' });
  const unscheduled = useMemo(() => mine.filter((t) => !t.dueDate && t.status !== 'DONE'), [mine]);
  useHotkey('1', () => void navigate(PATHS.list!));
  useHotkey('2', () => void navigate(PATHS.board!));
  useHotkey('3', () => void navigate(PATHS.calendar!));
  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>My tasks calendar</h1>
      <TaskCalendar
        scheduled={scheduled}
        unscheduled={unscheduled}
        cursor={cursor}
        range={range}
        onCursorChange={setCursor}
        onRangeChange={setRange}
        label="My tasks"
        tabs={
          <ViewTabs
            tabs={MY_TASKS_TABS}
            value="calendar"
            label="My tasks views"
            onChange={(id) => void navigate(PATHS[id] ?? '/my-tasks')}
          />
        }
      />
    </div>
  );
}
