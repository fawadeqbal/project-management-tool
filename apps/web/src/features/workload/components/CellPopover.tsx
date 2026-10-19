import type { RefObject } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button, Icon, Popover } from '@hearth/ui';
import type { WorkloadDto, WorkloadPersonDto, WorkloadUnitDto } from '@hearth/contracts';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { dayLabelOf } from '../lib/days';
import { formatAmount, unitWord } from '../lib/workload-format';
import styles from '../workload.module.css';

export interface OpenCell {
  userId: string;
  date: string;
}

interface Props {
  open: OpenCell | null;
  anchorRef: RefObject<HTMLElement | null>;
  workload: WorkloadDto;
  onClose: () => void;
  onReassign: (taskId: string) => void;
}

/** That day's tasks for one person: key, title, share of the day; Open, Reassign…, or drag to someone else. */
export function CellPopover({ open, anchorRef, workload, onClose, onReassign }: Props) {
  const person = open ? workload.people.find((p) => p.user.id === open.userId) : undefined;
  const cell = person?.cells.find((c) => c.date === open?.date);
  return (
    <Popover
      open={!!(open && person && cell)}
      onOpenChange={(o) => !o && onClose()}
      anchorRef={anchorRef}
      aria-label="Tasks this day"
      role="dialog"
      className={styles.popover}
    >
      {person && cell ? (
        <div className={styles.popoverBody}>
          <div className={styles.popoverHead}>
            <strong>
              {dayLabelOf(workload, cell.date)} · {person.user.name}
            </strong>
            <span className={cell.state === 'over' ? styles.overText : styles.mutedText}>
              {cell.state === 'over' ? <Icon name="alert" size={12} /> : null}
              {formatAmount(cell.planned, workload.unit)} of {cell.capacity}{' '}
              {unitWord(cell.capacity, workload.unit)}
            </span>
          </div>
          {cell.items.length === 0 ? (
            <p className={styles.mutedText}>
              Nothing planned — {person.user.name.split(' ')[0]} has room this day.
            </p>
          ) : null}
          <ul className={styles.taskList}>
            {cell.items.map((item) => (
              <TaskChip
                key={item.taskId}
                person={person}
                taskId={item.taskId}
                amount={item.amount}
                unit={workload.unit}
                workload={workload}
                onClose={onClose}
                onReassign={onReassign}
              />
            ))}
          </ul>
          {cell.items.length ? (
            <p className={styles.hint}>Drag a task onto someone’s row to reassign it.</p>
          ) : null}
        </div>
      ) : null}
    </Popover>
  );
}

function TaskChip({
  person,
  taskId,
  amount,
  unit,
  workload,
  onClose,
  onReassign,
}: {
  person: WorkloadPersonDto;
  taskId: string;
  amount: number;
  unit: WorkloadUnitDto;
  workload: WorkloadDto;
  onClose: () => void;
  onReassign: (taskId: string) => void;
}) {
  const task = workload.tasks[taskId];
  const panel = useTaskPanel();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${taskId}`,
    data: { taskId, fromUserId: person.user.id },
  });
  if (!task) return null;
  return (
    <li className={isDragging ? styles.chipDragging : styles.chip}>
      <span
        ref={setNodeRef}
        className={styles.chipGrip}
        aria-label={`Drag ${task.key} to reassign`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={14} />
      </span>
      <span className={styles.chipKey}>{task.key}</span>
      <span className={styles.chipTitle}>{task.title}</span>
      <span className={styles.chipAmount}>{formatAmount(amount, unit)}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onClose();
          panel.open(task.key);
        }}
      >
        Open
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onReassign(taskId)}>
        Reassign…
      </Button>
    </li>
  );
}
