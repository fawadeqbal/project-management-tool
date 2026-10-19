import { useState, type FormEvent } from 'react';
import { Button, Popover } from '@hearth/ui';
import type { TaskDto, UpdateTaskInput } from '@hearth/contracts';
import styles from '../task-detail.module.css';

const parseNum = (v: string, int: boolean): number | null => {
  if (!v.trim()) return null;
  const n = int ? Math.round(Number(v)) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** "5 points · 8h" with a small popover to edit points and hours. */
export function EstimateEditor({ task, onSave, readOnly }: { task: TaskDto; onSave: (patch: UpdateTaskInput) => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState('');
  const [hours, setHours] = useState('');

  const parts: string[] = [];
  if (task.estimatePoints != null) parts.push(`${task.estimatePoints} ${task.estimatePoints === 1 ? 'point' : 'points'}`);
  if (task.estimateHours != null) parts.push(`${task.estimateHours}h`);
  const label = parts.join(' · ');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    const patch: UpdateTaskInput = {};
    const p = parseNum(points, true);
    const h = parseNum(hours, false);
    if (p !== task.estimatePoints) patch.estimatePoints = p;
    if (h !== task.estimateHours) patch.estimateHours = h;
    if (Object.keys(patch).length) onSave(patch);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setPoints(task.estimatePoints?.toString() ?? '');
          setHours(task.estimateHours?.toString() ?? '');
        }
        setOpen(o);
      }}
      aria-label="Edit estimate"
      role="dialog"
      renderTrigger={(p) => (
        <button type="button" {...p} className={styles.propTrigger} disabled={readOnly} aria-label={label ? `Estimate: ${label}. Edit` : 'Add an estimate'}>
          {label || <span className={styles.muted}>Add estimate</span>}
        </button>
      )}
    >
      <form className={styles.estimateForm} onSubmit={submit}>
        <label className={styles.estimateField}>
          Points
          <input type="number" min={0} max={100} step={1} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
        </label>
        <label className={styles.estimateField}>
          Hours
          <input type="number" min={0} max={1000} step={0.5} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <Button type="submit" size="sm">
          Save
        </Button>
      </form>
    </Popover>
  );
}
