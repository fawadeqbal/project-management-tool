import { useNavigate } from 'react-router-dom';
import { EmptyState, ViewTabs } from '@hearth/ui';
import { MY_TASKS_TABS } from '@/features/my-tasks';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useTasks } from '@/shared/tasks/queries';
import { TaskBoard } from '../components/board/TaskBoard';
import { BoardSkeleton } from './ProjectBoardPage';
import styles from '../projects.module.css';

const PATHS: Record<string, string> = { list: '/my-tasks', board: '/my-tasks/board', calendar: '/my-tasks/calendar' };

/** My tasks as a board: the same board component over "mine" (no WIP limits — they're per project). */
export function MyTasksBoardPage() {
  const navigate = useNavigate();
  const myId = useAuthStore((s) => s.me?.user.id ?? null);
  const { data: tasks, isLoading } = useTasks({ scope: 'mine', includeDone: true });
  useHotkey('1', () => void navigate(PATHS.list!));
  useHotkey('2', () => void navigate(PATHS.board!));
  useHotkey('3', () => void navigate(PATHS.calendar!));
  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>My tasks</h1>
        <span className={styles.grow} />
        <ViewTabs tabs={MY_TASKS_TABS} value="board" label="My tasks views" onChange={(id) => void navigate(PATHS[id] ?? '/my-tasks')} />
      </div>
      {isLoading ? (
        <BoardSkeleton />
      ) : tasks?.length ? (
        <TaskBoard tasks={tasks} label="My tasks board" createDefaults={{ assigneeId: myId }} />
      ) : (
        <EmptyState icon="board" title="Nothing assigned to you" description="Press C to add a task — it lands here." />
      )}
    </div>
  );
}
