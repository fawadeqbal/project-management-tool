import { Button } from '@hearth/ui';
import styles from '../inbox.module.css';

/** Appears while items are selected with X. */
export function BulkBar({ count, onArchive, onMarkRead, onClear }: { count: number; onArchive: () => void; onMarkRead: () => void; onClear: () => void }) {
  return (
    <div className={styles.bulkBar} role="toolbar" aria-label="Selected items">
      <span className={styles.bulkCount} aria-live="polite">
        {count} selected
      </span>
      <span className={styles.grow} />
      <Button variant="ghost" size="sm" icon="check" onClick={onMarkRead}>
        Mark read
      </Button>
      <Button variant="ghost" size="sm" icon="archive" onClick={onArchive}>
        Archive
      </Button>
      <Button variant="ghost" size="sm" icon="x" aria-label="Clear selection" onClick={onClear} />
    </div>
  );
}
