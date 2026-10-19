import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { GroupHeader, TaskRow, toUiStatus } from '@hearth/ui';
import type { TaskDto, TaskStatusDto } from '@hearth/contracts';
import { groupAndSort, isTaskStatus, type GroupingId, type SortId, type TaskGroup } from '@hearth/domain';
import { useIsPhone } from '@/shared/hooks/useMediaQuery';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useUiStore } from '@/shared/layout/ui-store';
import { today } from './dates';
import { asIcon } from './meta';
import { MobileTaskRow } from './MobileTaskRow';
import { AssigneePicker, PriorityPicker, StatusPicker } from './pickers';
import { taskRowProps } from './task-row-props';
import { isOptimisticId, useTaskMutations } from './useTaskMutations';
import styles from './task-list.module.css';

export interface TaskListProps {
  tasks: readonly TaskDto[];
  grouping?: GroupingId;
  sort?: SortId;
  /** Accessible name of the list ("My tasks"). */
  label: string;
  onOpen: (task: TaskDto) => void;
  /** Task currently open in the panel — shown as selected. */
  activeTaskId?: string | null;
  /** Inline quick-add row or similar, rendered after the groups. */
  footer?: ReactNode;
  /** Shown instead of groups when there are no tasks. */
  empty?: ReactNode;
  /** Hide tag and due columns (narrow layouts). */
  compact?: boolean;
  /** Phone rows: hide the assignee avatar (lists that only hold your own tasks). */
  hideAssignee?: boolean;
  /** Bind J/K/X/Space/S/A/P while mounted (default true). Disable for secondary lists. */
  keyboard?: boolean;
  /** Group header "+" — receives the group so callers can prefill (status, due…). */
  onAddToGroup?: (group: TaskGroup<TaskDto>) => void;
  /** Names for project/assignee grouping. */
  projectNames?: Record<string, string>;
  userNames?: Record<string, string>;
  /** Fired when X changes the multi-selection. */
  onSelectionChange?: (ids: string[]) => void;
  /** Fired after a task is marked done from this list (Space or checkbox). */
  onCompleted?: (task: TaskDto) => void;
}

type PickerKind = 'status' | 'assignee' | 'priority';
const TONE_COLOR = {
  danger: 'var(--danger-icon)',
  brand: 'var(--brand-primary)',
  neutral: 'var(--text-secondary)',
} as const;

/**
 * Grouped task list (Strategy-based grouping and sorting from the domain). Keyboard:
 * J/K move · X select · Space complete · Enter open · S/A/P change status/assignee/priority.
 */
export function TaskList({
  tasks,
  grouping = 'due',
  sort = 'priority',
  label,
  onOpen,
  activeTaskId,
  footer,
  empty,
  compact,
  hideAssignee,
  keyboard = true,
  onAddToGroup,
  projectNames,
  userNames,
  onSelectionChange,
  onCompleted,
}: TaskListProps) {
  const listId = useId();
  const phone = useIsPhone();
  const mutations = useTaskMutations();
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const groups = useMemo(
    () => groupAndSort([...tasks], grouping, sort, { today: today(), projectNames, userNames }),
    [tasks, grouping, sort, projectNames, userNames],
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => setCollapsed({}), [grouping]);
  const isCollapsed = (g: TaskGroup<TaskDto>) => collapsed[g.id] ?? g.collapsedByDefault;

  const visible = useMemo(
    () => groups.flatMap((g) => ((collapsed[g.id] ?? g.collapsedByDefault) ? [] : g.items)),
    [groups, collapsed],
  );
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<{ kind: PickerKind; taskId: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const rowEl = (id: string) =>
    containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`) ?? null;
  const focusRow = useCallback((id: string) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  useEffect(() => {
    setSelectedTaskId(focusedId);
  }, [focusedId, setSelectedTaskId]);
  useEffect(() => () => setSelectedTaskId(null), [setSelectedTaskId]);

  const currentId = (): string | null => {
    const active = document.activeElement as HTMLElement | null;
    const fromDom = active?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    if (fromDom && containerRef.current?.contains(active)) return fromDom;
    return focusedId && byId.has(focusedId) ? focusedId : null;
  };

  const move = (delta: number) => {
    if (!visible.length) return;
    const id = currentId();
    const idx = id ? visible.findIndex((t) => t.id === id) : -1;
    const next =
      idx < 0 ? (delta > 0 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, idx + delta));
    focusRow(visible[next]!.id);
  };

  /** Row actions (Space, X, S/A/P) only act when the keyboard is actually in this list. */
  const focusInList = () => {
    const active = document.activeElement;
    return !!active && active !== document.body && !!containerRef.current?.contains(active);
  };

  const withCurrent = (fn: (task: TaskDto) => void) => () => {
    if (!focusInList()) return false;
    const id = currentId();
    const task = id ? byId.get(id) : undefined;
    if (!task || isOptimisticId(task.id)) return false;
    fn(task);
    return true;
  };

  const openPicker = (kind: PickerKind) =>
    withCurrent((task) => {
      anchorRef.current = rowEl(task.id);
      setPicker({ kind, taskId: task.id });
    });

  const toggleDone = (task: TaskDto) => {
    if (task.status !== 'DONE') onCompleted?.(task);
    void mutations.toggleDone(task);
  };

  const kb = { enabled: keyboard && tasks.length > 0 };
  useHotkey('J', () => move(1), kb);
  useHotkey('K', () => move(-1), kb);
  useHotkey('ArrowDown', () => (currentId() ? move(1) : false), kb);
  useHotkey('ArrowUp', () => (currentId() ? move(-1) : false), kb);
  useHotkey(
    'X',
    withCurrent((task) => {
      const next = new Set(selection);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      setSelection(next);
      onSelectionChange?.([...next]);
    }),
    kb,
  );
  useHotkey(
    'Space',
    (e) => {
      // Let real buttons inside the row (checkbox, menus) handle their own Space.
      if (e.target instanceof HTMLElement && e.target.closest('button, a')) return false;
      return withCurrent(toggleDone)();
    },
    kb,
  );
  useHotkey('S', openPicker('status'), kb);
  useHotkey('A', openPicker('assignee'), kb);
  useHotkey('P', openPicker('priority'), kb);

  const pickerTask = picker ? byId.get(picker.taskId) : undefined;
  const closePicker = (open: boolean) => {
    if (open) return;
    const id = picker?.taskId;
    setPicker(null);
    if (id) requestAnimationFrame(() => focusRow(id));
  };

  if (tasks.length === 0 && empty) {
    return (
      <>
        {empty}
        {footer ? (
          <div className={styles.list} role="table" aria-label={label}>
            {footer}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.list}
      data-phone={phone || undefined}
      role="table"
      aria-label={label}
      aria-rowcount={tasks.length}
    >
      {groups.map((g) => {
        const isOpen = !isCollapsed(g);
        const regionId = `${listId}-${g.id}`;
        return (
          <div key={g.id} role="rowgroup" className={styles.group}>
            <GroupHeader
              label={g.label}
              count={g.items.length}
              status={g.status && isTaskStatus(g.status) ? toUiStatus(g.status) : undefined}
              icon={g.status ? undefined : asIcon(g.icon)}
              iconColor={TONE_COLOR[g.tone]}
              collapsed={!isOpen}
              controls={regionId}
              onToggle={() => setCollapsed((c) => ({ ...c, [g.id]: isOpen }))}
              onAdd={onAddToGroup ? () => onAddToGroup(g) : undefined}
            />
            <div id={regionId} role="presentation" hidden={!isOpen} className={styles.rows}>
              {isOpen && phone
                ? g.items.map((task) => (
                    <MobileTaskRow
                      key={task.id}
                      task={task}
                      rowId={`${listId}-row-${task.id}`}
                      selected={selection.has(task.id) || task.id === activeTaskId}
                      hideAssignee={hideAssignee}
                      pending={isOptimisticId(task.id)}
                      onFocus={() => setFocusedId(task.id)}
                      onToggleDone={() => !isOptimisticId(task.id) && toggleDone(task)}
                      onSnooze={() => !isOptimisticId(task.id) && void mutations.snoozeToTomorrow(task)}
                      onOpen={() => !isOptimisticId(task.id) && onOpen(task)}
                    />
                  ))
                : null}
              {isOpen && !phone
                ? g.items.map((task) => (
                    <TaskRow
                      key={task.id}
                      {...taskRowProps(task)}
                      data-task-id={task.id}
                      rowId={`${listId}-row-${task.id}`}
                      compact={compact}
                      selected={selection.has(task.id) || task.id === activeTaskId}
                      aria-busy={isOptimisticId(task.id) || undefined}
                      className={isOptimisticId(task.id) ? styles.pending : undefined}
                      onFocus={() => setFocusedId(task.id)}
                      onToggleDone={() => !isOptimisticId(task.id) && toggleDone(task)}
                      onOpen={() => !isOptimisticId(task.id) && onOpen(task)}
                    />
                  ))
                : null}
            </div>
          </div>
        );
      })}
      {footer}
      {pickerTask && picker?.kind === 'status' ? (
        <StatusPicker
          open
          onOpenChange={closePicker}
          anchorRef={anchorRef}
          value={pickerTask.status}
          onChange={(status: TaskStatusDto) => void mutations.setStatus(pickerTask, status)}
        />
      ) : null}
      {pickerTask && picker?.kind === 'priority' ? (
        <PriorityPicker
          open
          onOpenChange={closePicker}
          anchorRef={anchorRef}
          value={pickerTask.priority}
          onChange={(priority) =>
            void mutations.update(
              pickerTask,
              { priority },
              { undoMessage: `${pickerTask.key} priority changed` },
            )
          }
        />
      ) : null}
      {pickerTask && picker?.kind === 'assignee' ? (
        <AssigneePicker
          open
          onOpenChange={closePicker}
          anchorRef={anchorRef}
          value={pickerTask.assigneeId}
          onChange={(assigneeId) =>
            void mutations.update(pickerTask, { assigneeId }, { undoMessage: `${pickerTask.key} reassigned` })
          }
        />
      ) : null}
    </div>
  );
}
