import { create } from 'zustand';

/** UI state for the create-project dialog (rendered once by ProjectsHost). */
interface ProjectsUiState {
  createOpen: boolean;
  createDefaults: { teamId?: string | null };
  openCreate: (defaults?: { teamId?: string | null }) => void;
  closeCreate: () => void;
}

export const useProjectsUi = create<ProjectsUiState>((set) => ({
  createOpen: false,
  createDefaults: {},
  openCreate: (defaults = {}) => set({ createOpen: true, createDefaults: defaults }),
  closeCreate: () => set({ createOpen: false }),
}));
