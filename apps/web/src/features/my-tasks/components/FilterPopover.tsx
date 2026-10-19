import { useState } from 'react';
import { Button, Popover, Switch } from '@hearth/ui';
import type { ProjectRefDto } from '@hearth/contracts';
import { PRIORITIES, PRIORITY_META, STATUS_META, TASK_STATUSES } from '@hearth/domain';
import type { MyTasksView } from '../view-state';
import styles from '../my-tasks.module.css';

interface Props {
  view: MyTasksView;
  onChange: (patch: Partial<MyTasksView>) => void;
  onReset: () => void;
  activeCount: number;
  projects: readonly ProjectRefDto[];
}

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function CheckGroup<T extends string>({ legend, options, value, onChange }: { legend: string; options: { id: T; label: string }[]; value: readonly T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.checks}>
        {options.map((o) => (
          <label key={o.id} className={styles.check}>
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => onChange(toggle(value, o.id))} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Filter: status, priority, project, overdue only, include done. */
export function FilterPopover({ view, onChange, onReset, activeCount, projects }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      aria-label="Filter tasks"
      role="dialog"
      renderTrigger={(p) => (
        <Button {...p} variant="secondary" size="sm" icon="filter">
          {activeCount ? `Filter · ${activeCount}` : 'Filter'}
        </Button>
      )}
    >
      <div className={styles.filterPanel}>
        <CheckGroup legend="Status" options={TASK_STATUSES.map((s) => ({ id: s, label: STATUS_META[s].label }))} value={view.statuses} onChange={(statuses) => onChange({ statuses })} />
        <CheckGroup legend="Priority" options={PRIORITIES.map((p) => ({ id: p, label: PRIORITY_META[p].label }))} value={view.priorities} onChange={(priorities) => onChange({ priorities })} />
        {projects.length ? (
          <CheckGroup legend="Project" options={projects.map((p) => ({ id: p.id, label: p.name }))} value={view.projectIds} onChange={(projectIds) => onChange({ projectIds })} />
        ) : null}
        <div className={styles.switches}>
          <Switch checked={view.overdueOnly} onChange={(overdueOnly) => onChange({ overdueOnly })} label="Overdue only" />
          <Switch checked={view.includeDone} onChange={(includeDone) => onChange({ includeDone })} label="Include done" />
        </div>
        <div className={styles.filterFooter}>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!activeCount}>
            Clear filters
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </div>
    </Popover>
  );
}
