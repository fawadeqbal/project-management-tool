import type { TaskDetailDto, UpdateTaskInput } from '@hearth/contracts';
import { usePermission } from '@/shared/auth/use-permission';
import { usePresence } from '@/shared/realtime';
import { useToast } from '@/shared/toast';
import { taskUrl } from '@/shared/tasks/useTaskPanel';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { useTaskDetailMutations } from '../api';
import { AiSummarySlot } from './AiSummarySlot';
import { CommentComposer } from './CommentComposer';
import { CommentsActivity } from './CommentsActivity';
import { DescriptionEditor } from './DescriptionEditor';
import { EditableTitle } from './EditableTitle';
import { PropertyGrid } from './PropertyGrid';
import { Subtasks } from './Subtasks';
import { TaskHeader } from './TaskHeader';
import styles from '../task-detail.module.css';

export interface TaskDetailViewProps {
  task: TaskDetailDto;
  mode: 'panel' | 'page';
  onClose?: () => void;
  onOpenFullPage?: () => void;
  /** Open another task (subtask, blocker) in the same surface. */
  onOpenTask: (key: string) => void;
  /** Called after the task is deleted. */
  onDeleted: () => void;
}

/** Everything about one task; shared by the side panel and the full page. */
export function TaskDetailView({
  task,
  mode,
  onClose,
  onOpenFullPage,
  onOpenTask,
  onDeleted,
}: TaskDetailViewProps) {
  const mutations = useTaskMutations();
  const detail = useTaskDetailMutations(task);
  const viewers = usePresence(task.id);
  const { show } = useToast();
  const canEdit = usePermission('tasks.edit');
  const canDelete = usePermission('tasks.delete');
  const canComment = usePermission('comments.create');

  const update = (patch: UpdateTaskInput, undoMessage?: string) =>
    void mutations.update(task, patch, { undoMessage });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(taskUrl(task.key));
      show({ message: 'Link copied', icon: 'link', tone: 'info' });
    } catch {
      show({ message: 'We couldn’t copy the link. Copy it from the address bar instead.', tone: 'danger' });
    }
  };

  const toggleSubtask = (id: string) => {
    const sub = task.subtasks.find((s) => s.id === id);
    if (sub) void mutations.toggleDone(sub);
  };

  return (
    <div className={styles.view} data-mode={mode}>
      <TaskHeader
        task={task}
        viewers={viewers}
        isFollowing={detail.isFollowing}
        canDelete={canDelete}
        mode={mode}
        onClose={onClose}
        onOpenFullPage={onOpenFullPage}
        onCopyLink={() => void copyLink()}
        onToggleFollow={() => detail.toggleFollow()}
        onDelete={() => {
          onDeleted();
          void mutations.remove(task);
        }}
      />
      <div className={styles.scroll}>
        <EditableTitle
          value={task.title}
          as={mode === 'page' ? 'h1' : 'h2'}
          disabled={!canEdit}
          onSave={(title) => update({ title })}
        />
        <PropertyGrid
          task={task}
          readOnly={!canEdit}
          onUpdate={update}
          onAddBlocker={(b) => detail.addBlocker(b)}
          onRemoveBlocker={(id) => detail.removeBlocker(id)}
        />
        <DescriptionEditor
          value={task.description}
          disabled={!canEdit}
          onSave={(description) => update({ description })}
        />
        <AiSummarySlot task={task} />
        <Subtasks
          task={task}
          readOnly={!canEdit}
          onToggle={toggleSubtask}
          onAdd={(title) => detail.addSubtask(title)}
          onOpen={onOpenTask}
        />
        <CommentsActivity task={task} />
      </div>
      {canComment ? <CommentComposer onSend={detail.addComment} /> : null}
    </div>
  );
}
