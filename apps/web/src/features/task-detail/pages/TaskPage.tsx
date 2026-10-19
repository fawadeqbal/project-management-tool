import { useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, Skeleton } from '@hearth/ui';
import { useTask } from '@/shared/tasks/queries';
import { TaskDetailView } from '../components/TaskDetailView';
import styles from '../task-detail.module.css';

/** Full-page task at /tasks/:key. */
export function TaskPage() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const { data: task, isLoading, isError } = useTask(key);

  if (isLoading) {
    return (
      <div className={styles.page} aria-busy="true" aria-label="Loading task">
        <Skeleton height={32} width="60%" />
        <Skeleton height={16} width="40%" />
      </div>
    );
  }
  if (isError || !task) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="search"
          title={`We couldn’t find ${key.toUpperCase()}`}
          description="It may have been deleted, or it lives in a project you can’t see. Ask the owner to share it."
          primaryAction={<Button onClick={() => void navigate('/my-tasks')}>Go to My tasks</Button>}
        />
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <TaskDetailView task={task} mode="page" onOpenTask={(k) => void navigate(`/tasks/${k}`)} onDeleted={() => void navigate('/my-tasks', { replace: true })} />
    </div>
  );
}
