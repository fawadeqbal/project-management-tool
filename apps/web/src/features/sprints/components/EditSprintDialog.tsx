import { useState } from 'react';
import { Button, Dialog, Input, Textarea } from '@hearth/ui';
import type { SprintSummaryDto, UpdateSprintInput } from '@hearth/contracts';
import styles from '../sprints.module.css';

interface Props {
  sprint: SprintSummaryDto;
  onClose: () => void;
  onSave: (input: UpdateSprintInput) => void;
}

/** Name, goal and dates. Mounted only while open so the form starts from the sprint's values. */
export function EditSprintDialog({ sprint, onClose, onSave }: Props) {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? '');
  const [startDate, setStart] = useState(sprint.startDate);
  const [endDate, setEnd] = useState(sprint.endDate);
  const invalid = endDate < startDate;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${sprint.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || invalid}
            onClick={() => {
              onSave({ name: name.trim(), goal: goal.trim() || null, startDate, endDate });
              onClose();
            }}
          >
            Save sprint
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} hint="One sentence the team can check every decision against." rows={2} />
        <div className={styles.formRow}>
          <Input label="Starts" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
          <Input label="Ends" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} error={invalid ? 'Pick an end date on or after the start.' : undefined} />
        </div>
      </div>
    </Dialog>
  );
}
