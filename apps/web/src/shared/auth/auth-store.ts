import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MeDto } from '@hearth/contracts';

export interface AuthState {
  token: string | null;
  /** Workspace every request is scoped to (sent as X-Workspace-Id). */
  workspaceId: string | null;
  /** Last known profile, so the shell renders instantly on reload; refreshed by useMe(). */
  me: MeDto | null;
  signIn: (token: string, me: MeDto) => void;
  setMe: (me: MeDto) => void;
  switchWorkspace: (workspaceId: string) => void;
  signOut: () => void;
}

/** Safe storage: private windows and blocked site data fall back to memory. */
const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__hearth_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    };
  }
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      workspaceId: null,
      me: null,
      signIn: (token, me) => set({ token, me, workspaceId: me.workspace.id }),
      setMe: (me) => set((s) => ({ me, workspaceId: s.workspaceId ?? me.workspace.id })),
      switchWorkspace: (workspaceId) => set({ workspaceId }),
      signOut: () => set({ token: null, workspaceId: null, me: null }),
    }),
    {
      name: 'hearth.auth',
      storage: safeStorage,
      partialize: (s) => ({ token: s.token, workspaceId: s.workspaceId, me: s.me }),
    },
  ),
);

/** Non-React accessors for the HTTP layer and socket client. */
export const authSnapshot = () => useAuthStore.getState();
