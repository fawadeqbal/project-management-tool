import { forwardRef, useMemo, useState, type KeyboardEvent } from 'react';
import { Icon, Kbd } from '@hearth/ui';
import { PRIORITY_META, humanizeDate, parseQuickAdd, type ParsedQuickAdd } from '@hearth/domain';
import { today } from '@/shared/tasks/dates';
import styles from '../my-tasks.module.css';

const CHIP_LABEL: Record<ParsedQuickAdd['tokens'][number]['kind'], string> = {
  assignee: 'Assignee',
  project: 'Project',
  priority: 'Priority',
  due: 'Due',
};

/** Chips that preview what the quick-add parser understood. */
export function QuickAddPreview({ parsed }: { parsed: ParsedQuickAdd }) {
  if (!parsed.tokens.length) return null;
  const t = today();
  const value = (kind: ParsedQuickAdd['tokens'][number]['kind'], text: string) => {
    if (kind === 'priority' && parsed.priority) return PRIORITY_META[parsed.priority].label;
    if (kind === 'due' && parsed.dueDate) return humanizeDate(parsed.dueDate, t);
    return text;
  };
  return (
    <ul className={styles.chips} aria-label="Recognized details">
      {parsed.tokens.map((tok) => (
        <li key={`${tok.kind}-${tok.text}`} className={styles.chip} data-kind={tok.kind}>
          <span className={styles.chipKind}>{CHIP_LABEL[tok.kind]}</span>
          {value(tok.kind, tok.text)}
        </li>
      ))}
    </ul>
  );
}

interface QuickAddRowProps {
  onSubmit: (text: string) => Promise<unknown> | void;
}

/**
 * "Add a task… type @ to assign, # for project, ! for priority". Enter submits; the parsed tokens
 * show as chips while typing. Esc clears and leaves.
 */
export const QuickAddRow = forwardRef<HTMLInputElement, QuickAddRowProps>(function QuickAddRow({ onSubmit }, ref) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseQuickAdd(text, today()), [text]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const value = text.trim();
      if (!value) return;
      setText('');
      void onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      e.currentTarget.blur();
    }
  };

  return (
    <div className={styles.quickAdd} role="row">
      <span role="cell" className={styles.quickAddCell}>
        <Icon name="plus" />
        <input
          ref={ref}
          className={styles.quickAddInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a task… type @ to assign, # for project, ! for priority"
          aria-label="Add a task. Type @ to assign, # for project, ! for priority, then press Enter"
          aria-keyshortcuts="C"
        />
        <QuickAddPreview parsed={parsed} />
        {!text ? <Kbd keys="C" aria-hidden="true" /> : null}
      </span>
    </div>
  );
});
