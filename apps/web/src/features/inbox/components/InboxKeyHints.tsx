import { Kbd } from '@hearth/ui';
import styles from '../inbox.module.css';

/** Footer key hints from the design; the shortcuts teach themselves. */
export function InboxKeyHints() {
  return (
    <div className={styles.hints} aria-label="Keyboard shortcuts">
      <span>
        <Kbd keys="E" /> Archive
      </span>
      <span>
        <Kbd keys="H" /> Snooze
      </span>
      <span>
        <Kbd keys="U" /> Unread
      </span>
      <span>
        <Kbd keys="X" /> Select
      </span>
      <span className={styles.hintsExtra}>
        <Kbd keys={['J', 'K']} /> Move
      </span>
    </div>
  );
}
