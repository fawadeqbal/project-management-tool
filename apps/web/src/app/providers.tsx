import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { ApiError, setUnauthorizedHandler } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { CommandsProvider, createCoreCommands, type Command } from '@/shared/commands';
import { hotkeys } from '@/shared/hotkeys/hotkey-service';
import { useUiStore } from '@/shared/layout/ui-store';
import { RealtimeProvider } from '@/shared/realtime';
import { ThemeProvider, useTheme, type ThemePreference } from '@/shared/theme';
import { toast, ToastRegion } from '@/shared/toast';
import { featureCommands } from './feature-registry';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          const e = error instanceof ApiError ? error : null;
          if (e && e.status >= 400 && e.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });

/** Outside the router: server state and theme (the login page needs both). */
export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  useEffect(() => hotkeys.attach(window), []);
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileTheme>
        {children}
        <ToastRegion />
      </ProfileTheme>
    </QueryClientProvider>
  );
}

/** Theme follows the profile preference and saves changes back to it. */
function ProfileTheme({ children }: { children: ReactNode }) {
  const pref = useAuthStore((s) => s.me?.user.theme);
  const signedIn = useAuthStore((s) => !!s.token);
  const client = useQueryClient();
  const onChange = useMemo(
    () => (theme: ThemePreference) => {
      if (!signedIn) return;
      api.me
        .update({ theme })
        .then((me) => {
          useAuthStore.getState().setMe(me);
          client.setQueriesData({ queryKey: queryKeys.me }, me);
        })
        .catch(() => undefined);
    },
    [signedIn, client],
  );
  return (
    <ThemeProvider preference={pref} onPreferenceChange={onChange}>
      {children}
    </ThemeProvider>
  );
}

/** Inside the router (needs navigate): commands, shortcuts, realtime. Wraps the app shell. */
export function ShellProviders({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { toggle } = useTheme();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuthStore.getState().signOut();
      client.clear();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      void navigate(`/login?next=${next}`, { replace: true });
      toast.show({ message: 'Your session ended. Log in again to pick up where you left off.', tone: 'info', icon: 'lock' });
    });
  }, [navigate, client]);

  const commands = useMemo<Command[]>(() => {
    const ui = useUiStore.getState;
    const core = createCoreCommands({
      openCreateTask: () => ui().openCreateTask(),
      toggleTheme: toggle,
      toggleSidebar: () => ui().toggleSidebar(),
      showShortcuts: () => ui().setShortcutsOpen(true),
      logOut: () => {
        useAuthStore.getState().signOut();
        client.clear();
        void navigate('/login', { replace: true });
      },
    });
    // Feature commands last so a feature can refine a core command by reusing its id.
    return [...core, ...featureCommands];
  }, [toggle, client, navigate]);

  return (
    <CommandsProvider commands={commands}>
      <RealtimeProvider>{children}</RealtimeProvider>
    </CommandsProvider>
  );
}
