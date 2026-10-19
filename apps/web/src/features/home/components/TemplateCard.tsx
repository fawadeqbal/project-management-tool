import type { ProjectTemplateDto } from '@hearth/contracts';
import { Icon, isIconName, Spinner } from '@hearth/ui';
import styles from '../home.module.css';

/** One template: tinted icon, name, what's inside. Clicking it creates the project. */
export function TemplateCard({ template, busy, onApply }: { template: ProjectTemplateDto; busy: boolean; onApply: (t: ProjectTemplateDto) => void }) {
  return (
    <button type="button" className={styles.template} onClick={() => onApply(template)} disabled={busy} aria-label={`Start from ${template.name}: ${template.description}, ${template.taskCount} tasks`}>
      <span className={styles.templateIcon} style={{ background: `var(--accent-${template.color}-avatar)`, color: `var(--accent-${template.color}-fg)` }} aria-hidden="true">
        {isIconName(template.icon) ? <Icon name={template.icon} size={20} /> : null}
      </span>
      <span className={styles.templateText}>
        <span className={styles.templateName}>{template.name}</span>
        <span className={styles.templateDesc}>{template.description}</span>
      </span>
      {busy ? <Spinner size={16} label="Creating project" /> : <Icon name="arrow-right" className={styles.templateArrow} />}
    </button>
  );
}
