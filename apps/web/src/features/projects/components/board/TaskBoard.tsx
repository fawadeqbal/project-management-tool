import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { BoardCard } from '@hearth/ui';
import type { CreateTaskInput, TaskDto, TaskStatusDto, WipLimitsDto } from '@hearth/contracts';
import { STATUS_META, wipLevel } from '@hearth/domain';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { patchTaskInCaches } from '@/shared/tasks/task-cache';
import { taskRowProps } from '@/shared/tasks/task-row-props';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { useToast } from '@/shared/toast';
import type { Swimlanes } from '../../view-state';
import { BoardColumn, ColumnHeader } from './BoardColumn';
import { MoveToMenu } from './MoveToMenu';
import { buildColumns, buildLanes, currentPlacement, keyboardPlacement, moveToStatus, placeAt, type BoardColumnModel, type KeyboardMove, type Placement } from './board-model';
import styles from './board.module.css';

export interface TaskBoardProps {
  tasks: readonly TaskDto[];
  /** Accessible name ("Website relaunch board"). */
  label: string;
  wipLimits?: WipLimitsDto;
  swimlanes?: Swimlanes;
  /** Prefilled on "+ Add task" (projectId, assigneeId…); the column adds its status. */
  createDefaults?: Partial<CreateTaskInput>;
}

const colId = (lane: string, status: TaskStatusDto) => `${lane}::${status}`;
const parseColId = (id: string) => {
  const [lane, status] = id.split('::') as [string, TaskStatusDto];
  return { lane, status };
};

const ARROWS: Record<string, KeyboardMove> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/**
 * Kanban board: columns per status, cards by boardPosition. Drag with the pointer (lifted, tilted
 * card + dashed drop zone) or with the keyboard (M = Move to…, Alt+←/→ between columns,
 * Alt+↑/↓ within one). Moves are optimistic with an Undo toast; over-limit WIP warns, never blocks.
 */
export function TaskBoard({ tasks, label, wipLimits = {}, swimlanes = 'none', createDefaults = {} }: TaskBoardProps) {
  const client = useQueryClient();
  const mutations = useTaskMutations();
  const panel = useTaskPanel();
  const { show } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [activeId, setActiveId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ columnId: string; index: number } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const allColumns = useMemo(() => buildColumns(tasks, wipLimits), [tasks, wipLimits]);
  const statuses = allColumns.map((c) => c.status);
  const lanes = useMemo(
    () =>
      buildLanes(tasks, swimlanes).map((lane) => ({
        ...lane,
        columns: buildColumns(lane.tasks, {}, statuses).filter((c) => statuses.includes(c.status)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statuses derives from allColumns
    [tasks, swimlanes, allColumns],
  );
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const columnOf = useCallback(
    (laneId: string, status: TaskStatusDto): BoardColumnModel | undefined => lanes.find((l) => l.id === laneId)?.columns.find((c) => c.status === status),
    [lanes],
  );
  const laneOfTask = (task: TaskDto) => (swimlanes === 'none' ? 'all' : swimlanes === 'priority' ? task.priority : (task.assigneeId ?? 'none'));

  const focusCard = (id: string) =>
    requestAnimationFrame(() => boardRef.current?.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`)?.focus());

  /** Apply a placement optimistically, with Undo for status changes and a WIP warning. */
  const commit = useCallback(
    (task: TaskDto, to: Placement, opts: { undo?: boolean } = {}) => {
      const from = currentPlacement(allColumns, task);
      const statusChanged = to.status !== task.status;
      patchTaskInCaches(client, task.id, (t) => ({ ...t, boardPosition: to.position }));
      void mutations.move(task, { status: statusChanged ? to.status : undefined, beforeId: to.beforeId, afterId: to.afterId, ordering: 'board' }, false);
      if (statusChanged && opts.undo !== false) {
        show({
          message: `Moved ${task.key} to ${STATUS_META[to.status].label}`,
          action: 'Undo',
          onAction: () => {
            patchTaskInCaches(client, task.id, (t) => ({ ...t, boardPosition: from.position }));
            void mutations.move({ ...task, status: to.status }, { status: from.status, beforeId: from.beforeId, afterId: from.afterId, ordering: 'board' }, false);
          },
        });
        const target = allColumns.find((c) => c.status === to.status);
        const limit = target?.wipLimit ?? null;
        const count = (target?.count ?? 0) + 1;
        if (limit && wipLevel(count, limit) === 'over')
          show({
            message: `${target!.label} is over its WIP limit (${count} / ${limit}). Finish something before starting more.`,
            tone: 'info',
            icon: 'alert',
          });
      }
    },
    [allColumns, client, mutations, show],
  );

  // ── Keyboard ──
  const onCardKeyDown = (task: TaskDto, e: KeyboardEvent<HTMLDivElement>) => {
    if (!e.altKey || !(e.key in ARROWS)) return;
    e.preventDefault();
    const lane = laneOfTask(task);
    const laneColumns = lanes.find((l) => l.id === lane)?.columns ?? allColumns;
    const to = keyboardPlacement(laneColumns, task, ARROWS[e.key]!);
    if (!to) return;
    commit(task, to);
    focusCard(task.id);
  };

  const openMoveMenu = useCallback(() => {
    const id = focusedRef.current;
    if (!id || !byId.has(id)) return false;
    anchorRef.current = boardRef.current?.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`) ?? null;
    setMoveMenuFor(id);
    return true;
  }, [byId]);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'board.move-to',
        title: 'Move to…',
        group: 'Tasks',
        icon: 'arrow-right',
        shortcut: ['M'],
        keywords: ['status', 'column', 'board'],
        isAvailable: () => !!focusedRef.current && byId.has(focusedRef.current),
        run: () => void openMoveMenu(),
      },
    ],
    [byId, openMoveMenu],
  );
  useRegisterCommands(commands);

  // ── Pointer drag ──
  const targetOf = (overId: string, overColumn?: string): { columnId: string; overTaskId: string | null } | null => {
    if (overId.includes('::')) return { columnId: overId, overTaskId: null };
    const t = byId.get(overId);
    if (!t) return overColumn ? { columnId: overColumn, overTaskId: null } : null;
    return { columnId: overColumn ?? colId(laneOfTask(t), t.status), overTaskId: overId };
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragOver = (e: DragOverEvent) => {
    const active = byId.get(String(e.active.id));
    if (!active || !e.over) return setDrop(null);
    const target = targetOf(String(e.over.id), e.over.data.current?.columnId as string | undefined);
    if (!target) return setDrop(null);
    const sourceCol = colId(laneOfTask(active), active.status);
    if (target.columnId === sourceCol) return setDrop(null);
    const { lane, status } = parseColId(target.columnId);
    const list = columnOf(lane, status)?.tasks ?? [];
    const index = target.overTaskId ? list.findIndex((t) => t.id === target.overTaskId) : list.length;
    setDrop({ columnId: target.columnId, index: index < 0 ? list.length : index });
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    setDrop(null);
    const task = byId.get(String(e.active.id));
    if (!task || !e.over) return;
    const target = targetOf(String(e.over.id), e.over.data.current?.columnId as string | undefined);
    if (!target) return;
    const { lane, status } = parseColId(target.columnId);
    const list = columnOf(lane, status)?.tasks ?? [];
    const without = list.filter((t) => t.id !== task.id);
    let index = without.length;
    if (target.overTaskId && target.overTaskId !== task.id) {
      const overPos = without.findIndex((t) => t.id === target.overTaskId);
      const oldIndex = list.findIndex((t) => t.id === task.id);
      const overIndex = list.findIndex((t) => t.id === target.overTaskId);
      index = oldIndex >= 0 && oldIndex < overIndex ? overPos + 1 : overPos;
    } else if (target.overTaskId === task.id) return;
    const to = placeAt(list, index, status, task.id);
    if (to.status === task.status && to.beforeId === currentPlacement(allColumns, task).beforeId && to.afterId === currentPlacement(allColumns, task).afterId) return;
    commit(task, to);
  };

  const activeTask = activeId ? byId.get(activeId) : undefined;
  const menuTask = moveMenuFor ? byId.get(moveMenuFor) : undefined;

  const renderColumns = (laneId: string, columns: BoardColumnModel[], showHeader: boolean) =>
    columns.map((column) => {
      const id = colId(laneId, column.status);
      const totals = allColumns.find((c) => c.status === column.status) ?? column;
      return (
        <BoardColumn
          key={id}
          id={id}
          column={showHeader ? totals : column}
          dropIndex={drop?.columnId === id ? drop.index : null}
          adding={adding === id}
          onAddingChange={(open) => setAdding(open ? id : null)}
          onAdd={(title) =>
            void mutations.create({
              ...createDefaults,
              title,
              status: column.status,
              ...(swimlanes === 'assignee' && laneId !== 'all' ? { assigneeId: laneId === 'none' ? null : laneId } : {}),
            })
          }
          onOpen={(t) => panel.open(t.key)}
          onFocusCard={(t) => (focusedRef.current = t.id)}
          onCardKeyDown={onCardKeyDown}
          showHeader={showHeader}
        />
      );
    });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => (setActiveId(null), setDrop(null))}>
      <div ref={boardRef} className={styles.board} role="region" aria-label={label}>
        {swimlanes === 'none' ? (
          <div className={styles.columns}>{renderColumns('all', allColumns, true)}</div>
        ) : (
          <div className={styles.lanes}>
            <div className={styles.columns} aria-hidden="false">
              {allColumns.map((c) => (
                <div key={c.status} className={styles.laneHeaderCell}>
                  <ColumnHeader column={c} />
                </div>
              ))}
            </div>
            {lanes.map((lane) => (
              <section key={lane.id} aria-label={lane.label} className={styles.lane}>
                <h3 className={styles.laneTitle}>
                  {lane.label} <span className={styles.laneCount}>{lane.tasks.length}</span>
                </h3>
                <div className={styles.columns}>{renderColumns(lane.id, lane.columns, false)}</div>
              </section>
            ))}
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <BoardCard
            id={activeTask.key}
            title={activeTask.title}
            priority={taskRowProps(activeTask).priority}
            tags={activeTask.tags.slice(0, 2).map((t) => ({ label: t.name, color: t.color }))}
            due={taskRowProps(activeTask).due}
            dueTone={taskRowProps(activeTask).dueTone}
            comments={activeTask.commentCount}
            assignee={activeTask.assignee?.initials}
            assigneeColor={activeTask.assignee?.avatarColor}
            dragging
          />
        ) : null}
      </DragOverlay>
      {menuTask ? (
        <MoveToMenu
          task={menuTask}
          anchorRef={anchorRef}
          onClose={() => setMoveMenuFor(null)}
          onMove={(status) => {
            commit(menuTask, moveToStatus(allColumns, menuTask, status));
            focusCard(menuTask.id);
          }}
          onReorder={(where) => {
            const to = keyboardPlacement(allColumns, menuTask, where);
            if (to) commit(menuTask, to);
            focusCard(menuTask.id);
          }}
        />
      ) : null}
    </DndContext>
  );
}
