import type { ReactNode } from 'react';
import { Button } from '@hearth/ui';
import type { SnoozePresetDto } from '@hearth/contracts';
import { SnoozeMenu } from './SnoozeMenu';
import styles from '../inbox.module.css';

export interface DetailActionHandlers {
  onSnooze: (preset: SnoozePresetDto) => void;
  onArchive: () => void;
  onOpenTask?: () => void;
  /** Controlled so the H shortcut can open the snooze menu. */
  snoozeOpen: boolean;
  onSnoozeOpenChange: (open: boolean) => void;
  /** Phone layout: back to the list. */
  onBack?: () => void;
}

/** Top row of the detail pane: status badge on the left, Snooze / Archive / Open task on the right. */
export function DetailActions({ badge, onSnooze, onArchive, onOpenTask, snoozeOpen, onSnoozeOpenChange, onBack }: DetailActionHandlers & { badge?: ReactNode }) {
  return (
    <div className={styles.detailActions}>
      {onBack ? (
        <Button variant="ghost" size="sm" icon="inbox" className={styles.backButton} onClick={onBack}>
          Back to inbox
        </Button>
      ) : null}
      {badge}
      <span className={styles.grow} />
      <SnoozeMenu
        onSnooze={onSnooze}
        open={snoozeOpen}
        onOpenChange={onSnoozeOpenChange}
        trigger={
          <Button variant="ghost" size="sm" icon="clock" aria-keyshortcuts="H">
            Snooze
          </Button>
        }
      />
      <Button variant="ghost" size="sm" icon="archive" onClick={onArchive} aria-keyshortcuts="E">
        Archive
      </Button>
      {onOpenTask ? (
        <Button variant="ghost" size="sm" icon="arrow-up-right" onClick={onOpenTask} aria-keyshortcuts="Enter">
          Open task
        </Button>
      ) : null}
    </div>
  );
}
