import { useEffect, useState } from 'react';
import type { ProjectTemplateDto } from '@hearth/contracts';
import { Button, Dialog, Input } from '@hearth/ui';
import { TemplateCard } from './TemplateCard';
import styles from '../home.module.css';

export interface TemplatesDialogProps {
  open: boolean;
  templates: ProjectTemplateDto[];
  busyId: string | null;
  onClose: () => void;
  onApply: (t: ProjectTemplateDto, name?: string) => void;
}

/** "Browse all templates": every template, with an optional project name. */
export function TemplatesDialog({ open, templates, busyId, onClose, onApply }: TemplatesDialogProps) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Start from a template"
      description="Each one creates a project with sections and starter tasks you can edit."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className={styles.dialogBody}>
        <Input
          label="Project name (optional)"
          placeholder="Uses the template name if empty"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <div className={styles.templateGridDialog}>
          {templates.map((t) => (
            <div key={t.id} className={styles.templateWithMeta}>
              <TemplateCard
                template={t}
                busy={busyId === t.id}
                onApply={(tt) => onApply(tt, name.trim() || undefined)}
              />
              <span className={styles.templateMeta}>
                {t.taskCount} tasks · {t.sections.join(' → ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
