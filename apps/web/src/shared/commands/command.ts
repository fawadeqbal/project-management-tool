import type { ReactNode } from 'react';

/**
 * Command pattern: every action reachable from ⌘K, a shortcut or a menu is a Command object.
 * Features contribute commands; the palette, hotkey service and menus only know this interface
 * (Dependency Inversion), so adding a feature never edits the palette.
 */
export interface CommandContext {
  navigate: (to: string) => void;
  /** Current route params (projectId, task key…) so commands can act on "this". */
  params: Record<string, string | undefined>;
  /** The task currently selected or open in the panel, if any. */
  selectedTaskId?: string | null;
}

export type CommandGroup = 'AI' | 'Tasks' | 'Actions' | 'Navigate' | 'Projects' | 'Settings';

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** Hearth icon name. */
  icon?: string;
  /** Keys shown in the palette and bound by the hotkey service, e.g. ['G', 'I'] or ['C']. */
  shortcut?: string[];
  /** Extra words that should match in fuzzy search. */
  keywords?: string[];
  /** Hidden from the palette when false (e.g. "Change status" with no selected task). */
  isAvailable?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => void | Promise<void>;
  /** Optional right-hand hint, e.g. "overdue 2 days". */
  hint?: ReactNode;
}
