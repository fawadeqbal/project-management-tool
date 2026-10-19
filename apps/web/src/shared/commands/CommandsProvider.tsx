import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useMatches, useNavigate } from 'react-router-dom';
import { hotkeys as defaultHotkeys, type HotkeyService } from '@/shared/hotkeys/hotkey-service';
import { useUiStore } from '@/shared/layout/ui-store';
import type { Command, CommandContext } from './command';
import { CommandRegistry } from './command-registry';

const RegistryContext = createContext<CommandRegistry | null>(null);

/**
 * Creates the CommandRegistry for the app. Lives inside the router so commands can navigate.
 * `commands` = featureCommands + core commands; components add more with useRegisterCommands.
 */
export function CommandsProvider({
  commands,
  children,
  hotkeyService = defaultHotkeys,
}: {
  commands: readonly Command[];
  children: ReactNode;
  hotkeyService?: HotkeyService;
}) {
  const navigate = useNavigate();
  // The deepest match carries every param (projectId, key…) even though we render in a layout.
  const matches = useMatches();
  const params = matches[matches.length - 1]?.params ?? {};
  const ctxRef = useRef<CommandContext>({ navigate: () => undefined, params: {} });
  useEffect(() => {
    ctxRef.current = {
      navigate: (to: string) => void navigate(to),
      params,
      selectedTaskId: useUiStore.getState().selectedTaskId,
    };
  });
  const [registry] = useState(
    () =>
      new CommandRegistry(commands, hotkeyService, () => ({
        ...ctxRef.current,
        selectedTaskId: useUiStore.getState().selectedTaskId,
      })),
  );
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    registry.setStatic(commands);
  }, [registry, commands]);
  useEffect(() => {
    registry.activate();
    return () => registry.dispose();
  }, [registry]);
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

export function useCommandRegistry(): CommandRegistry {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error('useCommandRegistry must be used inside <CommandsProvider>.');
  return registry;
}

/** Every registered command, re-rendering when the set changes. */
export function useCommands(): Command[] {
  const registry = useCommandRegistry();
  return useSyncExternalStore(
    (cb) => registry.subscribe(cb),
    () => registry.all(),
    () => registry.all(),
  );
}

/**
 * Registers commands while the calling component is mounted (e.g. "Change status…" while a task
 * is focused). Pass a memoized array; the set is replaced whenever it changes.
 */
export function useRegisterCommands(commands: readonly Command[] | null | undefined) {
  const registry = useCommandRegistry();
  const stable = useMemo(() => commands ?? [], [commands]);
  useEffect(() => {
    if (!stable.length) return;
    return registry.register(stable);
  }, [registry, stable]);
}
