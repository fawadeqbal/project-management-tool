import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, StatusIcon } from '@hearth/ui';
import type { TaskDetailDto, TaskRefDto } from '@hearth/contracts';
import { allCachedTasks } from '@/shared/tasks/task-cache';
import { useTasks } from '@/shared/tasks/queries';
import { PickerList, PropertyPopover } from '@/shared/tasks/pickers';
import { STATUS_ICON } from '@/shared/tasks/meta';
import styles from '../task-detail.module.css';

interface Props {
  task: TaskDetailDto;
  onAdd: (blocker: TaskRefDto) => void;
  onRemove: (blockerId: string) => void;
  readOnly?: boolean;
}

/** Blocked-by list: each item shows its status; add by searching key or title, remove with ×. */
export function BlockedByEditor({ task, onAdd, onRemove, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  // Search the workspace's open tasks once the picker opens; merge in anything already cached.
  const { data: workspaceTasks } = useTasks({ scope: 'workspace', limit: 200 }, { enabled: open });
  const candidates = useMemo(() => {
    if (!open) return [];
    const exclude = new Set([task.id, ...task.blockedBy.map((b) => b.id), ...task.subtasks.map((s) => s.id)]);
    const byId = new Map([...allCachedTasks(client), ...(workspaceTasks ?? [])].map((t) => [t.id, t]));
    return [...byId.values()].filter((t) => !exclude.has(t.id) && !t.id.startsWith('optimistic-'));
  }, [open, client, workspaceTasks, task]);

  return (
    <div className={styles.blockers}>
      {task.blockedBy.length === 0 ? <span className={styles.muted}>Nothing</span> : null}
      <ul className={styles.blockerList}>
        {task.blockedBy.map((b) => (
          <li key={b.id} className={styles.blocker}>
            <StatusIcon
              status={b.status === 'DONE' ? 'done' : 'blocked'}
              label={b.status === 'DONE' ? 'Done' : 'Blocking'}
            />
            <span className={styles.mono}>{b.key}</span>
            <span className={styles.blockerTitle}>· {b.title}</span>
            {!readOnly ? (
              <Button
                variant="ghost"
                size="sm"
                icon="x"
                aria-label={`Remove ${b.key} from blocked by`}
                onClick={() => onRemove(b.id)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <PropertyPopover
          open={open}
          onOpenChange={setOpen}
          label="Add a blocking task"
          renderTrigger={(p) => (
            <button type="button" {...p} className={styles.iconButton}>
              <span className={styles.muted}>+ Add blocker</span>
            </button>
          )}
        >
          <PickerList
            label="Blocking task"
            searchable
            placeholder="Search by key or title…"
            emptyText={workspaceTasks ? 'No tasks match.' : 'Loading tasks…'}
            options={candidates.slice(0, 200).map((t) => ({
              id: t.id,
              text: `${t.key} ${t.title}`,
              label: (
                <span className={styles.option}>
                  <span className={styles.mono}>{t.key}</span> {t.title}
                </span>
              ),
              icon: STATUS_ICON[t.status].icon,
              iconColor: STATUS_ICON[t.status].color,
            }))}
            onSelect={(id) => {
              const t = candidates.find((c) => c.id === id);
              setOpen(false);
              if (t) onAdd({ id: t.id, key: t.key, title: t.title, status: t.status });
            }}
          />
        </PropertyPopover>
      ) : null}
    </div>
  );
}
