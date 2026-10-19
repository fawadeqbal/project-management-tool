import { create } from 'zustand';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastOptions {
  message: string;
  /** Action label, e.g. "Undo" or "Open task". Omit for an informational toast. */
  action?: string;
  onAction?: () => void;
  /** Hearth icon name; defaults by tone. */
  icon?: string;
  tone?: ToastTone;
  /** Auto-dismiss after this long (default 8s, the Undo window). */
  durationMs?: number;
  /** Replace an existing toast with the same id instead of stacking. */
  id?: string;
}

export interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'durationMs' | 'tone'>> {
  id: string;
  action?: string;
  onAction?: () => void;
  icon?: string;
}

export const DEFAULT_TOAST_MS = 8000;
const MAX_VISIBLE = 3;

interface ToastState {
  toasts: ToastItem[];
  show: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (opts) => {
    const id = opts.id ?? `t${++seq}`;
    const item: ToastItem = {
      id,
      message: opts.message,
      action: opts.action,
      onAction: opts.onAction,
      icon: opts.icon,
      tone: opts.tone ?? 'success',
      durationMs: opts.durationMs ?? DEFAULT_TOAST_MS,
    };
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== id), item].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Imperative access for non-React code (mutation callbacks, the socket client). */
export const toast = {
  show: (opts: ToastOptions) => useToastStore.getState().show(opts),
  error: (message: string, opts: Omit<ToastOptions, 'message' | 'tone'> = {}) =>
    useToastStore.getState().show({ icon: 'alert', ...opts, message, tone: 'danger' }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
