import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, Textarea } from '@hearth/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ScheduleDialogProps {
  open: boolean;
  initial: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (recipients: string[]) => void;
}

/** Weekly dashboard email: who gets it. */
export function ScheduleDialog({ open, initial, busy, onClose, onSubmit }: ScheduleDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setValue(initial.join(', '));
      setError(undefined);
    }
  }, [open, initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const list = [
      ...new Set(
        value
          .split(/[\s,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const bad = list.find((x) => !EMAIL.test(x));
    if (!list.length) return setError('Add at least one email, like sara@acme.com.');
    if (bad) return setError(`“${bad}” is missing something — try sara@acme.com.`);
    onSubmit(list);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Schedule email"
      description="A snapshot of this dashboard every Monday at 9:00."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="schedule-form" icon="clock" loading={busy}>
            Send weekly
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} noValidate>
        <Textarea
          label="Recipients"
          hint="Separate emails with commas."
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          placeholder="sara@acme.com, mo@acme.com"
        />
      </form>
    </Dialog>
  );
}
