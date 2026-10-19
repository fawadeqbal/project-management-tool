import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from '../task-detail.module.css';

interface Props {
  value: string;
  onSave: (title: string) => void;
  /** Heading level: h2 in the panel, h1 on the full page. */
  as?: 'h1' | 'h2';
  disabled?: boolean;
}

/** Click (or Enter on focus) to edit; Enter or blur saves, Esc cancels. Empty titles aren't saved. */
export function EditableTitle({ value, onSave, as: Heading = 'h2', disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.replace(/\s+/g, ' ').trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        className={styles.titleInput}
        value={draft}
        rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 40)))}
        aria-label="Task title"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <Heading className={styles.title}>
      <button type="button" className={styles.titleButton} onClick={() => !disabled && setEditing(true)} disabled={disabled} aria-label={`${value}. Edit title`}>
        {value}
      </button>
    </Heading>
  );
}
