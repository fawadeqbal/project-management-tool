import { create } from 'zustand';
import type { CreateTaskInput } from '@hearth/contracts';

export type PaletteMode = 'search' | 'ai';
export type PaletteScope = 'all' | 'tasks' | 'projects' | 'people' | 'commands';

/** Defaults a caller can pre-fill when opening the create-task dialog (e.g. from a project). */
export type CreateTaskDefaults = Partial<
  Pick<
    CreateTaskInput,
    | 'projectId'
    | 'sectionId'
    | 'parentId'
    | 'sprintId'
    | 'assigneeId'
    | 'status'
    | 'priority'
    | 'dueDate'
    | 'title'
  >
>;

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  palette: { open: boolean; mode: PaletteMode; scope: PaletteScope; initialQuery: string };
  createTask: { open: boolean; defaults: CreateTaskDefaults };
  shortcutsOpen: boolean;
  /** The task the keyboard is on (focused row) — commands act on "this". */
  selectedTaskId: string | null;

  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  openPalette: (opts?: { mode?: PaletteMode; scope?: PaletteScope; query?: string }) => void;
  closePalette: () => void;
  openCreateTask: (defaults?: CreateTaskDefaults) => void;
  closeCreateTask: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
}

const SIDEBAR_KEY = 'hearth.sidebarCollapsed';
const readSidebar = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
};

/** Small app-wide UI state (not server state). */
export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: typeof window === 'undefined' ? false : readSidebar(),
  mobileNavOpen: false,
  palette: { open: false, mode: 'search', scope: 'all', initialQuery: '' },
  createTask: { open: false, defaults: {} },
  shortcutsOpen: false,
  selectedTaskId: null,

  toggleSidebar: () =>
    set((s) => {
      // Below the desktop breakpoint "[" opens/closes the drawer instead.
      if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
        return { mobileNavOpen: !s.mobileNavOpen };
      }
      const next = !s.sidebarCollapsed;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed: next };
    }),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  openPalette: (opts = {}) =>
    set({
      palette: {
        open: true,
        mode: opts.mode ?? 'search',
        scope: opts.scope ?? 'all',
        initialQuery: opts.query ?? '',
      },
    }),
  closePalette: () => set((s) => ({ palette: { ...s.palette, open: false } })),
  openCreateTask: (defaults = {}) => set({ createTask: { open: true, defaults } }),
  closeCreateTask: () => set((s) => ({ createTask: { ...s.createTask, open: false } })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}));
