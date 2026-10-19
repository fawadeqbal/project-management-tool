import type { HotkeyService } from '@/shared/hotkeys/hotkey-service';
import type { Command, CommandContext } from './command';

type Listener = () => void;

/**
 * Holds every Command: static ones from features (`featureCommands`) plus dynamic sets that
 * components register while mounted (`useRegisterCommands`). Shortcuts are bound through the
 * HotkeyService, so a command is reachable from ⌘K and its keys with one definition.
 */
export class CommandRegistry {
  private readonly staticCommands: Command[];
  private readonly dynamic = new Map<string, Command[]>();
  private readonly listeners = new Set<Listener>();
  private unbind: (() => void)[] = [];
  private snapshot: Command[] = [];
  private nextSet = 1;

  constructor(
    commands: readonly Command[],
    private readonly hotkeys: HotkeyService,
    private readonly getContext: () => CommandContext,
  ) {
    this.staticCommands = [...commands];
    this.rebuild();
  }

  /** All commands; later registrations override earlier ones with the same id. */
  all(): Command[] {
    return this.snapshot;
  }

  /** Commands that make sense right now (for the palette). */
  available(ctx: CommandContext = this.getContext()): Command[] {
    return this.snapshot.filter((c) => !c.isAvailable || c.isAvailable(ctx));
  }

  get(id: string): Command | undefined {
    return this.snapshot.find((c) => c.id === id);
  }

  async run(idOrCommand: string | Command): Promise<boolean> {
    const command = typeof idOrCommand === 'string' ? this.get(idOrCommand) : idOrCommand;
    if (!command) return false;
    const ctx = this.getContext();
    if (command.isAvailable && !command.isAvailable(ctx)) return false;
    await command.run(ctx);
    return true;
  }

  /** Register a set of commands; returns an unregister function. */
  register(commands: readonly Command[]): () => void {
    const key = `set${this.nextSet++}`;
    this.dynamic.set(key, [...commands]);
    this.rebuild();
    return () => {
      if (this.dynamic.delete(key)) this.rebuild();
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  dispose(): void {
    this.unbind.forEach((u) => u());
    this.unbind = [];
    this.listeners.clear();
  }

  private rebuild(): void {
    const byId = new Map<string, Command>();
    for (const c of this.staticCommands) byId.set(c.id, c);
    for (const set of this.dynamic.values()) for (const c of set) byId.set(c.id, c);
    this.snapshot = [...byId.values()];
    this.bindShortcuts();
    this.listeners.forEach((l) => l());
  }

  private bindShortcuts(): void {
    this.unbind.forEach((u) => u());
    this.unbind = this.snapshot
      .filter((c) => c.shortcut && c.shortcut.length > 0)
      .map((c) =>
        this.hotkeys.register(c.shortcut!, () => {
          const ctx = this.getContext();
          if (c.isAvailable && !c.isAvailable(ctx)) return false;
          void c.run(ctx);
          return true;
        }, { priority: -1, allowInModals: c.shortcut!.length === 1 && /^(mod|cmd|ctrl|⌘)/i.test(c.shortcut![0]!) }),
      );
  }
}
