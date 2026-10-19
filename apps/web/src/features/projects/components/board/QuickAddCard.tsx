import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@hearth/ui';
import styles from './board.module.css';

/** "+ Add task" at the foot of a column: inline title entry with the column's status preset. */
export function QuickAddCard({ label, open, onOpenChange, onSubmit }: { label: string; open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState('');
  if (!open)
    return (
      <button type="button" className={styles.addTask} onClick={() => onOpenChange(true)}>
        <Icon name="plus" />
        Add task
      </button>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    onSubmit(text);
    setTitle('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setTitle('');
      onOpenChange(false);
    }
  };
  return (
    <form className={styles.quickAdd} onSubmit={submit}>
      <input
        autoFocus
        className={styles.quickAddInput}
        aria-label={`New task in ${label}`}
        placeholder="Task title — Enter to add, Esc to cancel"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title.trim() && onOpenChange(false)}
      />
    </form>
  );
}
