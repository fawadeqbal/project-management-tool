import { create } from 'zustand';
import { ApiError } from '@/shared/api/http';

interface PlanGateState {
  /** The message of the 402 that opened the dialog (what the feature does, which plan has it). */
  dialog: { message: string; feature: string | null } | null;
  /** Features that returned 402 at least once this session — they show a calm banner. */
  blocked: Record<string, true>;
  open: (message: string, feature: string | null) => void;
  close: () => void;
}

export const usePlanGateStore = create<PlanGateState>((set) => ({
  dialog: null,
  blocked: {},
  open: (message, feature) => set((s) => ({ dialog: { message, feature }, blocked: feature ? { ...s.blocked, [feature]: true } : s.blocked })),
  close: () => set({ dialog: null }),
}));

/**
 * Turns a 402 `limit_reached` into the contextual upgrade prompt. Returns true when it handled the
 * error, so callers can skip their own error toast.
 */
export const handlePlanLimit = (err: unknown): boolean => {
  if (!(err instanceof ApiError) || err.kind !== 'limit_reached') return false;
  const feature = typeof err.details?.feature === 'string' ? err.details.feature : null;
  usePlanGateStore.getState().open(err.message, feature);
  return true;
};
