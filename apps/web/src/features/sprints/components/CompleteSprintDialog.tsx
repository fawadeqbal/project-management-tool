import { useState } from 'react';
import { Button, Dialog } from '@hearth/ui';
import type { SprintDetailDto } from '@hearth/contracts';
import styles from '../sprints.module.css';

interface Props {
  open: boolean;
  detail: SprintDetailDto;
  nextSprintName: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (moveTo: 'backlog' | 'next') => void;
}

/** Completing is irreversible, so it asks — and decides where unfinished work goes in the same step. */
export function CompleteSprintDialog({ open, detail, nextSprintName, busy, onClose, onConfirm }: Props) {
  const [moveTo, setMoveTo] = useState<'backlog' | 'next'>('backlog');
  const unfinished = detail.tasks.filter((t) => t.status !== 'DONE');
  const unfinishedPoints = unfinished.reduce((a, t) => a + (t.points ?? 0), 0);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Complete ${detail.sprint.name}?`}
      description={`${detail.progress.donePoints} of ${detail.progress.totalPoints} points are done. Completing a sprint can’t be undone.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep sprint open
          </Button>
          <Button loading={busy} onClick={() => onConfirm(moveTo)}>
            Complete sprint
          </Button>
        </>
      }
    >
      {unfinished.length ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legendTitle}>
            Move {unfinished.length} unfinished {unfinished.length === 1 ? 'task' : 'tasks'} ({unfinishedPoints} pts) to…
          </legend>
          <label className={styles.choice}>
            <input type="radio" name="move-to" value="backlog" checked={moveTo === 'backlog'} onChange={() => setMoveTo('backlog')} />
            <span>
              <strong>Top of the backlog</strong>
              <span className={styles.choiceHint}>Re-plan them next time, in the order they were in.</span>
            </span>
          </label>
          <label className={styles.choice}>
            <input type="radio" name="move-to" value="next" checked={moveTo === 'next'} onChange={() => setMoveTo('next')} />
            <span>
              <strong>{nextSprintName ?? 'A new next sprint'}</strong>
              <span className={styles.choiceHint}>{nextSprintName ? 'Carry them straight over.' : 'We’ll plan the next sprint for you and carry them over.'}</span>
            </span>
          </label>
        </fieldset>
      ) : (
        <p className={styles.muted}>Everything in this sprint is done. Nice work.</p>
      )}
    </Dialog>
  );
}
