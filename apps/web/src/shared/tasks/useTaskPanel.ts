import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const TASK_PARAM = 'task';

/**
 * The task side panel is driven by `?task=KEY` on any route, so it is linkable and the back
 * button closes it. `open('HRT-142')` keeps the current page underneath.
 */
export function useTaskPanel() {
  const [params, setParams] = useSearchParams();
  const openKey = params.get(TASK_PARAM);
  const open = useCallback(
    (key: string) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set(TASK_PARAM, key);
          return next;
        },
        { replace: !!params.get(TASK_PARAM) },
      ),
    [setParams, params],
  );
  const close = useCallback(
    () =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.delete(TASK_PARAM);
        return next;
      }),
    [setParams],
  );
  return { openKey, open, close };
}

/** Absolute link to a task's full page (for "Copy link"). */
export const taskUrl = (key: string) => `${window.location.origin}/tasks/${key}`;
