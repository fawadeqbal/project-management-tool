import { type KeyboardEvent, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, StatusIcon, toUiStatus } from '@hearth/ui';
import type { TaskDto } from '@hearth/contracts';
import { BoardCardItem } from './BoardCardItem';
import { QuickAddCard } from './QuickAddCard';
import { wipLabel, type BoardColumnModel } from './board-model';
import styles from './board.module.css';

export interface BoardColumnProps {
  id: string;
  column: BoardColumnModel;
  /** Index where a card from another column would land (shows the dashed drop zone). */
  dropIndex: number | null;
  adding: boolean;
  onAddingChange: (open: boolean) => void;
  onAdd: (title: string) => void;
  onOpen: (task: TaskDto) => void;
  onFocusCard: (task: TaskDto) => void;
  onCardKeyDown: (task: TaskDto, e: KeyboardEvent<HTMLDivElement>) => void;
  showHeader?: boolean;
}

export function BoardColumn({
  id,
  column,
  dropIndex,
  adding,
  onAddingChange,
  onAdd,
  onOpen,
  onFocusCard,
  onCardKeyDown,
  showHeader = true,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { columnId: id } });
  const done = column.status === 'DONE';
  const dropzone = <div className="ht-dropzone">Drop to move to {column.label}</div>;
  const cards: ReactNode[] = column.tasks.map((t) => (
    <BoardCardItem
      key={t.id}
      task={t}
      columnId={id}
      muted={done}
      onOpen={onOpen}
      onFocusCard={onFocusCard}
      onCardKeyDown={onCardKeyDown}
    />
  ));
  if (dropIndex !== null)
    cards.splice(Math.min(dropIndex, cards.length), 0, <div key="__drop">{dropzone}</div>);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}, ${column.count} ${column.count === 1 ? 'task' : 'tasks'}`}
      className={styles.column}
      data-over={isOver || undefined}
      data-status={column.status}
    >
      {showHeader ? <ColumnHeader column={column} onAdd={() => onAddingChange(true)} /> : null}
      <SortableContext id={id} items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.cards}>{cards}</div>
      </SortableContext>
      <QuickAddCard label={column.label} open={adding} onOpenChange={onAddingChange} onSubmit={onAdd} />
    </section>
  );
}

/** StatusIcon · label · "3" or "3 / 4 WIP" (amber near/over the limit) · add. */
export function ColumnHeader({
  column,
  onAdd,
}: {
  column: Pick<BoardColumnModel, 'status' | 'label' | 'count' | 'wipLimit' | 'wipLevel'>;
  onAdd?: () => void;
}) {
  const wip = wipLabel(column);
  return (
    <div className={styles.columnHeader}>
      <StatusIcon status={toUiStatus(column.status)} />
      <span className={styles.columnLabel}>{column.label}</span>
      <span
        className={styles.count}
        data-warn={wip.warn || undefined}
        data-testid={`wip-${column.status}`}
        title={wip.description}
      >
        {wip.text}
        {wip.description ? <span className={styles.srOnly}> — {wip.description}</span> : null}
      </span>
      {onAdd ? (
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          aria-label={`Add task to ${column.label}`}
          onClick={onAdd}
        />
      ) : null}
    </div>
  );
}
