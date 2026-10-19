import { useEffect, useState } from 'react';
import { matchMutation, useIsMutating, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@hearth/ui';
import { TASK_SAVE_KEY } from '@/shared/tasks/useTaskMutations';
import styles from '../task-detail.module.css';

/** Autosave status: "Saving…" while any task write is in flight, then "Saved". */
export function SaveIndicator() {
  const client = useQueryClient();
  const saving = useIsMutating({ mutationKey: TASK_SAVE_KEY }) > 0;
  const [everSaved, setEverSaved] = useState(false);

  // Watch the cache directly: fast saves can finish before a render ever sees "saving".
  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type === 'added' && matchMutation({ mutationKey: TASK_SAVE_KEY }, event.mutation))
          setEverSaved(true);
      }),
    [client],
  );

  return (
    <span className={styles.saveState} role="status" aria-live="polite">
      {saving ? (
        <>
          <Icon name="loader" spin />
          Saving…
        </>
      ) : (
        <>
          <Icon name="status-done" style={{ color: 'var(--success-icon)' }} />
          {everSaved ? 'Saved' : 'Up to date'}
        </>
      )}
    </span>
  );
}
