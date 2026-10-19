import { useState, type ReactNode } from 'react';
import { Avatar, Icon, Priority, StatusPill, Tag, toUiPriority, toUiStatus } from '@hearth/ui';
import type { TaskDetailDto, UpdateTaskInput } from '@hearth/contracts';
import { STATUS_META, humanizeDate, parseDateOnly } from '@hearth/domain';
import { dueInfo, today } from '@/shared/tasks/dates';
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  StatusPicker,
  TagPicker,
  type PopoverTriggerProps,
} from '@/shared/tasks/pickers';
import { BlockedByEditor } from './BlockedByEditor';
import { EstimateEditor } from './EstimateEditor';
import styles from '../task-detail.module.css';

type Picker = 'status' | 'assignee' | 'start' | 'due' | 'priority' | 'tags' | null;

interface Props {
  task: TaskDetailDto;
  onUpdate: (patch: UpdateTaskInput, undoMessage?: string) => void;
  onAddBlocker: Parameters<typeof BlockedByEditor>[0]['onAdd'];
  onRemoveBlocker: (id: string) => void;
  readOnly?: boolean;
}

function Trigger({
  props,
  label,
  children,
  disabled,
}: {
  props: PopoverTriggerProps;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" {...props} className={styles.propTrigger} aria-label={label} disabled={disabled}>
      {children}
      {!disabled ? <Icon name="chevron-down" className={styles.propChevron} /> : null}
    </button>
  );
}

/** Status, assignee, dates, priority, tags, estimate · sprint, blocked by — each editable inline. */
export function PropertyGrid({ task, onUpdate, onAddBlocker, onRemoveBlocker, readOnly }: Props) {
  const [picker, setPicker] = useState<Picker>(null);
  const openChange = (p: Exclude<Picker, null>) => (open: boolean) => setPicker(open ? p : null);
  const done = task.status === 'DONE';
  const due = dueInfo(task.dueDate, { done });
  const t = today();
  const startLabel = task.startDate ? humanizeDate(parseDateOnly(task.startDate), t) : 'Start';

  return (
    <dl className={styles.props}>
      <dt>Status</dt>
      <dd>
        <StatusPicker
          open={picker === 'status'}
          onOpenChange={openChange('status')}
          value={task.status}
          onChange={(status) =>
            onUpdate({ status }, status === 'DONE' ? `${task.key} marked as done` : undefined)
          }
          renderTrigger={(p) => (
            <Trigger
              props={p}
              label={`Status: ${STATUS_META[task.status].label}. Change status`}
              disabled={readOnly}
            >
              <StatusPill status={toUiStatus(task.status)} />
            </Trigger>
          )}
        />
      </dd>

      <dt>Assignee</dt>
      <dd>
        <AssigneePicker
          open={picker === 'assignee'}
          onOpenChange={openChange('assignee')}
          value={task.assigneeId}
          onChange={(assigneeId) => onUpdate({ assigneeId }, `${task.key} reassigned`)}
          renderTrigger={(p) => (
            <Trigger
              props={p}
              label={
                task.assignee
                  ? `Assignee: ${task.assignee.name}. Change assignee`
                  : 'Unassigned. Assign someone'
              }
              disabled={readOnly}
            >
              {task.assignee ? (
                <>
                  <Avatar
                    initials={task.assignee.initials}
                    name={task.assignee.name}
                    color={task.assignee.avatarColor}
                  />
                  {task.assignee.name}
                </>
              ) : (
                <span className={styles.muted}>Unassigned</span>
              )}
            </Trigger>
          )}
        />
      </dd>

      <dt>Dates</dt>
      <dd
        className={styles.dates}
        data-tone={due && (due.overdue || due.dueToday) && !done ? 'danger' : undefined}
      >
        <Icon name="calendar" className={styles.dateIcon} />
        <DatePicker
          open={picker === 'start'}
          onOpenChange={openChange('start')}
          value={task.startDate}
          label="Start date"
          onChange={(startDate) => onUpdate({ startDate })}
          renderTrigger={(p) => (
            <button
              type="button"
              {...p}
              className={styles.dateButton}
              disabled={readOnly}
              aria-label={task.startDate ? `Start date: ${startLabel}. Change` : 'Set start date'}
            >
              {task.startDate ? startLabel : <span className={styles.muted}>Start</span>}
            </button>
          )}
        />
        <span aria-hidden="true">→</span>
        <DatePicker
          open={picker === 'due'}
          onOpenChange={openChange('due')}
          value={task.dueDate}
          label="Due date"
          onChange={(dueDate) => onUpdate({ dueDate }, dueDate ? undefined : `${task.key} due date cleared`)}
          renderTrigger={(p) => (
            <button
              type="button"
              {...p}
              className={styles.dateButton}
              disabled={readOnly}
              aria-label={due ? `Due ${due.label}. Change due date` : 'Set due date'}
            >
              {due ? due.label : <span className={styles.muted}>Due date</span>}
            </button>
          )}
        />
        {due && !done && due.overdue ? <span className={styles.dateNote}>· overdue</span> : null}
        {due && !done && due.dueToday ? <span className={styles.dateNote}>· due today</span> : null}
      </dd>

      <dt>Priority</dt>
      <dd>
        <PriorityPicker
          open={picker === 'priority'}
          onOpenChange={openChange('priority')}
          value={task.priority}
          onChange={(priority) => onUpdate({ priority })}
          renderTrigger={(p) => (
            <Trigger props={p} label="Change priority" disabled={readOnly}>
              <Priority level={toUiPriority(task.priority)} showLabel />
            </Trigger>
          )}
        />
      </dd>

      <dt>Tags</dt>
      <dd className={styles.tags}>
        {task.tags.map((tag) => (
          <Tag key={tag.id} color={tag.color}>
            {tag.name}
          </Tag>
        ))}
        <TagPicker
          open={picker === 'tags'}
          onOpenChange={openChange('tags')}
          value={task.tags}
          onChange={(tagIds) => onUpdate({ tagIds })}
          renderTrigger={(p) =>
            readOnly ? null : (
              <button
                type="button"
                {...p}
                className={styles.iconButton}
                aria-label={task.tags.length ? 'Edit tags' : 'Add tags'}
              >
                <Icon name="plus" />
                {task.tags.length ? null : <span className={styles.muted}>Add tags</span>}
              </button>
            )
          }
        />
      </dd>

      <dt>Estimate</dt>
      <dd>
        <EstimateEditor task={task} onSave={(patch) => onUpdate(patch)} readOnly={readOnly} />
        {task.sprint ? <span className={styles.muted}> · {task.sprint.name}</span> : null}
      </dd>

      <dt>Blocked by</dt>
      <dd>
        <BlockedByEditor task={task} onAdd={onAddBlocker} onRemove={onRemoveBlocker} readOnly={readOnly} />
      </dd>
    </dl>
  );
}
