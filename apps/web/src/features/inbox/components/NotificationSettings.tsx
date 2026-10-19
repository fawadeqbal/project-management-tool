import { useState } from 'react';
import { Button, Popover } from '@hearth/ui';
import styles from '../inbox.module.css';

/** Explains what lands in the inbox (the settings button in the design). */
export function NotificationSettings() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      renderTrigger={(p) => <Button {...p} variant="ghost" size="sm" icon="settings" aria-label="Notification settings" />}
    >
      <div className={styles.settings}>
        <strong>You’re notified when</strong>
        <ul>
          <li>someone @mentions you or replies to you</li>
          <li>a task is assigned to you</li>
          <li>someone asks for your approval, or decides on yours</li>
          <li>a task you follow changes status or is completed</li>
        </ul>
        <p>Follow or unfollow a task from its panel to tune the rest.</p>
      </div>
    </Popover>
  );
}
