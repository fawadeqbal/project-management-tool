import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, Dialog, Input, Kbd, Priority, Select, StatusPill, Textarea, toUiPriority, toUiStatus } from '@hearth/ui';
import type { PriorityDto, TaskStatusDto } from '@hearth/contracts';
import { humanizeDate, parseDateOnly } from '@hearth/domain';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useMemberMap, useShell } from '@/shared/workspace/hooks';
import { useToast } from '@/shared/toast';
import { useUiStore } from '@/shared/layout/ui-store';
import { today } from './dates';
import { AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from './pickers';
import { useTaskMutations } from './useTaskMutations';
import { useTaskPanel } from './useTaskPanel';
import styles from './create-task.module.css';

interface Draft {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string | null;
  priority: PriorityDto;
  status: TaskStatusDto;
  dueDate: string | null;
}

/** Create task (C from anywhere). Submitting adds it optimistically and offers "Open task". */
export function CreateTaskDialog() {
  const { open, defaults } = useUiStore((s) => s.createTask);
  const close = useUiStore((s) => s.closeCreateTask);
  const me = useAuthStore((s) => s.me);
  const { data: shell } = useShell();
  const members = useMemberMap();
  const { create } = useTaskMutations();
  const { show } = useToast();
  const panel = useTaskPanel();
  const titleRef = useRef<HTMLInputElement>(null);

  const initial = (): Draft => ({
    title: defaults.title ?? '',
    description: '',
    projectId: defaults.projectId ?? '',
    assigneeId: defaults.assigneeId === undefined ? (me?.user.id ?? null) : defaults.assigneeId,
    priority: defaults.priority ?? 'NONE',
    status: defaults.status ?? 'TODO',
    dueDate: defaults.dueDate ?? null,
  });
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<'status' | 'assignee' | 'priority' | 'due' | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.title.trim()) {
      setError('Add a title — it can’t be empty.');
      titleRef.current?.focus();
      return;
    }
    setSubmitting(true);
    const task = await create({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      projectId: draft.projectId || null,
      sectionId: defaults.sectionId ?? null,
      parentId: defaults.parentId ?? null,
      sprintId: defaults.sprintId ?? null,
      assigneeId: draft.assigneeId,
      priority: draft.priority,
      status: draft.status,
      dueDate: draft.dueDate,
    });
    setSubmitting(false);
    if (!task) return; // the mutation already explained what went wrong
    close();
    show({ message: `${task.key} created`, action: 'Open task', onAction: () => panel.open(task.key) });
  };

  const assignee = draft.assigneeId ? members.get(draft.assigneeId) : null;
  const projects = shell?.favorites ?? [];

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create task"
      size="lg"
      initialFocusRef={titleRef}
      footer={
        <>
          <span className={styles.hint}>
            <Kbd keys={['⌘', '↵']} /> to create
          </span>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="create-task-form" loading={submitting}>
            Create task
          </Button>
        </>
      }
    >
      <form
        id="create-task-form"
        className={styles.form}
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
      >
        <Input
          ref={titleRef}
          label="Title"
          placeholder="What needs doing?"
          value={draft.title}
          error={error ?? undefined}
          onChange={(e) => {
            set('title', e.target.value);
            if (error) setError(null);
          }}
        />
        <Textarea label="Description" placeholder="Add details, links or acceptance criteria…" rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        <div className={styles.props}>
          <StatusPicker
            open={picker === 'status'}
            onOpenChange={(o) => setPicker(o ? 'status' : null)}
            value={draft.status}
            onChange={(s) => set('status', s)}
            renderTrigger={(p) => (
              <button type="button" {...p} className={styles.chip} aria-label="Status">
                <StatusPill status={toUiStatus(draft.status)} />
              </button>
            )}
          />
          <AssigneePicker
            open={picker === 'assignee'}
            onOpenChange={(o) => setPicker(o ? 'assignee' : null)}
            value={draft.assigneeId}
            onChange={(id) => set('assigneeId', id)}
            renderTrigger={(p) => (
              <button type="button" {...p} className={styles.chip} aria-label="Assignee">
                {assignee ? <Avatar initials={assignee.initials} color={assignee.avatarColor} size={20} name={assignee.name} /> : null}
                {assignee ? assignee.name : 'Unassigned'}
              </button>
            )}
          />
          <PriorityPicker
            open={picker === 'priority'}
            onOpenChange={(o) => setPicker(o ? 'priority' : null)}
            value={draft.priority}
            onChange={(p) => set('priority', p)}
            renderTrigger={(p) => (
              <button type="button" {...p} className={styles.chip} aria-label="Priority">
                <Priority level={toUiPriority(draft.priority)} showLabel />
              </button>
            )}
          />
          <DatePicker
            open={picker === 'due'}
            onOpenChange={(o) => setPicker(o ? 'due' : null)}
            value={draft.dueDate}
            onChange={(d) => set('dueDate', d)}
            label="Due date"
            renderTrigger={(p) => (
              <button type="button" {...p} className={styles.chip} aria-label="Due date">
                {draft.dueDate ? `Due ${humanizeDate(parseDateOnly(draft.dueDate), today())}` : 'No due date'}
              </button>
            )}
          />
        </div>
        <Select
          label="Project"
          value={draft.projectId}
          onChange={(e) => set('projectId', e.target.value)}
          options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          hint={projects.length ? undefined : 'Favorite a project to pick it here.'}
        />
      </form>
    </Dialog>
  );
}
