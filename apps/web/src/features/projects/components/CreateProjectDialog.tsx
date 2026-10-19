import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Input, Select } from '@hearth/ui';
import { ACCENT_COLORS, type AccentColor } from '@hearth/domain';
import { useTeams } from '@/shared/workspace/hooks';
import { useToast } from '@/shared/toast';
import { useCreateProject } from '../api';
import { useProjectsUi } from '../projects-ui';
import styles from '../projects.module.css';

const COLOR_LABEL: Record<AccentColor, string> = { blue: 'Blue', green: 'Green', sky: 'Sky', violet: 'Violet', amber: 'Amber', rose: 'Rose', slate: 'Slate' };

/** "Create project": name, color, team, due date. Opens the new project's board on success. */
export function CreateProjectDialog() {
  const { createOpen, createDefaults, closeCreate } = useProjectsUi();
  const navigate = useNavigate();
  const { show } = useToast();
  const { data: teams = [] } = useTeams();
  const create = useCreateProject();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<AccentColor>('blue');
  const [teamId, setTeamId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!createOpen) return;
    setName('');
    setColor('blue');
    setTeamId(createDefaults.teamId ?? '');
    setDueDate('');
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [createOpen]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, color, teamId: teamId || null, dueDate: dueDate || null },
      {
        onSuccess: (project) => {
          closeCreate();
          show({ message: `${project.name} created`, icon: 'folder', action: 'Open overview', onAction: () => void navigate(`/projects/${project.id}/overview`) });
          void navigate(`/projects/${project.id}/board`);
        },
      },
    );
  };

  const error = create.error;
  return (
    <Dialog
      open={createOpen}
      onClose={closeCreate}
      title="Create project"
      description="You’ll own it; add people by assigning them tasks or picking a team."
      initialFocusRef={nameRef}
      footer={
        <>
          <Button variant="ghost" onClick={closeCreate}>
            Cancel
          </Button>
          <Button type="submit" form="create-project-form" loading={create.isPending}>
            Create project
          </Button>
        </>
      }
    >
      <form id="create-project-form" className={styles.form} onSubmit={submit} noValidate>
        <Input ref={nameRef} label="Name" placeholder="e.g. Help center relaunch" value={name} onChange={(e) => setName(e.target.value)} error={error?.field('name')} required />
        <fieldset className={styles.colorField}>
          <legend className={styles.cardLabel}>Color</legend>
          <div className={styles.swatches} role="radiogroup" aria-label="Color">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={COLOR_LABEL[c]}
                className={styles.swatch}
                style={{ background: `var(--accent-${c}-dot)` }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </fieldset>
        <Select
          label="Team"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          options={[{ value: '', label: 'No team' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
          error={error?.field('teamId')}
        />
        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={error?.field('dueDate')} />
        {error && !Object.keys(error.fieldErrors).length ? (
          <p role="alert" className={styles.formError}>
            {error.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
