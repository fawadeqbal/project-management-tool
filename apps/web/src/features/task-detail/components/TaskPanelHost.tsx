import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Skeleton } from '@hearth/ui';
import { isTypingTarget } from '@/shared/hotkeys/hotkey-service';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useTask } from '@/shared/tasks/queries';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { TaskDetailView } from './TaskDetailView';
import styles from '../task-detail.module.css';

/**
 * Side panel driven by `?task=KEY` on any route. Opening remembers the focused element and Esc /
 * close returns focus to it. Below 768px the panel is a full-screen sheet.
 */
export function TaskPanelHost() {
  const { openKey, open, close } = useTaskPanel();
  const navigate = useNavigate();
  const { data: task, isLoading, isError, error } = useTask(openKey);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openKey) return;
    if (!returnFocus.current) returnFocus.current = document.activeElement as HTMLElement | null;
    // Move focus into the panel for keyboard and screen-reader users.
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  }, [openKey]);

  const closePanel = () => {
    const target = returnFocus.current;
    returnFocus.current = null;
    close();
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  };

  useHotkey(
    'Escape',
    () => {
      // First Esc leaves a field inside the panel (blur autosaves); the next one closes.
      const active = document.activeElement;
      if (active instanceof HTMLElement && panelRef.current?.contains(active) && isTypingTarget(active)) {
        active.blur();
        panelRef.current.focus({ preventScroll: true });
        return;
      }
      closePanel();
    },
    { enabled: !!openKey },
  );

  if (!openKey) return null;

  let body;
  if (isLoading) {
    body = (
      <div className={styles.loading} aria-busy="true" aria-label="Loading task">
        <Skeleton height={14} width={80} />
        <Skeleton height={28} width="80%" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={16} width={`${70 - i * 6}%`} />
        ))}
      </div>
    );
  } else if (isError || !task) {
    const notFound = error && 'status' in error && (error as { status: number }).status === 404;
    body = (
      <div className={styles.loading}>
        <EmptyState
          icon="search"
          title={notFound ? `We couldn’t find ${openKey}` : 'This task didn’t load'}
          description={notFound ? 'It may have been deleted or moved to a project you can’t see.' : 'Check your connection and try again.'}
          primaryAction={<Button variant="secondary" onClick={closePanel}>Close panel</Button>}
        />
      </div>
    );
  } else {
    body = (
      <TaskDetailView
        task={task}
        mode="panel"
        onClose={closePanel}
        onOpenFullPage={() => void navigate(`/tasks/${task.key}`)}
        onOpenTask={open}
        onDeleted={closePanel}
      />
    );
  }

  return (
    <aside ref={panelRef} tabIndex={-1} className={styles.panel} aria-label={task ? `Task ${task.key}` : 'Task'}>
      {body}
    </aside>
  );
}
