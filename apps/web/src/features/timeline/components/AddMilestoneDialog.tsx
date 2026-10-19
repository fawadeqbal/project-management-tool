import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Input } from '@hearth/ui';
import { ApiError, http } from '@/shared/api/http';
import { PROJECT_ROUTES, type MilestoneDto } from '@hearth/contracts';
import { useToast } from '@/shared/toast';
import { todayIso } from '@/shared/tasks/dates';
import { timelineKeys } from '../api';

/** "Add milestone": name + date. The diamond appears on the timeline right away. */
export function AddMilestoneDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const { show } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const m = await http.post<MilestoneDto>(PROJECT_ROUTES.milestones(projectId), { name, date });
      void client.invalidateQueries({ queryKey: timelineKeys.project(projectId) });
      void client.invalidateQueries({ queryKey: ['projects'] });
      show({ message: `Milestone “${m.name}” added`, icon: 'flag' });
      setName('');
      setError(null);
      onClose();
    } catch (err) {
      setError(ApiError.from(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add milestone"
      size="sm"
      initialFocusRef={ref}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-milestone" loading={saving}>
            Add milestone
          </Button>
        </>
      }
    >
      <form
        id="add-milestone"
        onSubmit={(e) => void submit(e)}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <Input
          ref={ref}
          label="Name"
          placeholder="e.g. Beta launch"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error?.field('name') ?? (error && !error.field('date') ? error.message : undefined)}
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={error?.field('date')}
        />
      </form>
    </Dialog>
  );
}
