import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineTaskRowDto } from '@hearth/contracts';
import { useUpgradePrompt } from '@/features/billing';
import { useToast } from '@/shared/toast';
import { shiftIso, useApplySchedule, useReschedule } from '../api';

export interface Draft {
  startDate: string;
  dueDate: string;
}

export type DragMode = 'move' | 'start' | 'end';

/** Applies a day delta to a bar for a drag mode, never letting the end pass the start. */
export const applyDelta = (row: Pick<TimelineTaskRowDto, 'startDate' | 'dueDate'>, mode: DragMode, days: number): Draft => {
  if (mode === 'move') return { startDate: shiftIso(row.startDate, days), dueDate: shiftIso(row.dueDate, days) };
  if (mode === 'start') {
    const s = shiftIso(row.startDate, days);
    return { startDate: s > row.dueDate ? row.dueDate : s, dueDate: row.dueDate };
  }
  const e = shiftIso(row.dueDate, days);
  return { startDate: row.startDate, dueDate: e < row.startDate ? row.startDate : e };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Local "draft" dates while a bar is dragged or nudged with the keyboard, committed as one
 * reschedule (dependents shift server-side) with an Undo toast that restores every date.
 */
export function useScheduleDrafts(projectId: string, opts: { keyboardDelayMs?: number } = {}) {
  const { keyboardDelayMs = 450 } = opts;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const reschedule = useReschedule(projectId);
  const applySchedule = useApplySchedule(projectId);
  const { show } = useToast();
  const upgrade = useUpgradePrompt();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const setDraft = useCallback((id: string, draft: Draft | null) => {
    setDrafts((d) => {
      const next = { ...d };
      if (draft) next[id] = draft;
      else delete next[id];
      return next;
    });
  }, []);

  const commit = useCallback(
    async (row: TimelineTaskRowDto, draft: Draft) => {
      timers.current.delete(row.id);
      if (draft.startDate === row.startDate && draft.dueDate === row.dueDate) return setDraft(row.id, null);
      try {
        const res = await reschedule.mutateAsync({ taskId: row.id, input: { ...draft, shiftDependents: true } });
        setDraft(row.id, null);
        const n = res.shifted.length;
        show({
          id: 'timeline-reschedule',
          message: n ? `Rescheduled ${row.key} · ${plural(n, 'dependent')} shifted` : `Rescheduled ${row.key}`,
          icon: 'calendar',
          action: 'Undo',
          onAction: () => void applySchedule.mutateAsync(res.previous).catch(() => undefined),
        });
      } catch (err) {
        setDraft(row.id, null);
        upgrade.handleError(err);
      }
    },
    [reschedule, applySchedule, show, setDraft, upgrade],
  );

  /** Keyboard nudges accumulate into one draft and commit after a short pause. */
  const nudge = useCallback(
    (row: TimelineTaskRowDto, mode: DragMode, days: number) => {
      const base = drafts[row.id] ?? row;
      const next = applyDelta(base, mode, days);
      setDraft(row.id, next);
      const prev = timers.current.get(row.id);
      if (prev) clearTimeout(prev);
      timers.current.set(
        row.id,
        setTimeout(() => void commit(row, next), keyboardDelayMs),
      );
    },
    [drafts, setDraft, commit, keyboardDelayMs],
  );

  return { drafts, setDraft, commit, nudge, upgradeElement: upgrade.element };
}
