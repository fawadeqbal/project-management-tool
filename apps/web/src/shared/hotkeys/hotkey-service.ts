/**
 * HotkeyService — one keydown listener for the whole app.
 *
 * Notation (strings or arrays, case-insensitive):
 *   "C"            single key
 *   "Mod+K"        ⌘ on macOS, Ctrl elsewhere ("⌘K", "Ctrl+K" are accepted too)
 *   "G I" / ["G", "I"]   two-key sequence; the second key must follow within 1 second
 *   "Shift+Enter", "Esc", "Space", "?", "[", "ArrowDown"
 *
 * Typing is never hijacked: inside inputs, textareas, selects and contenteditable only Mod
 * combos and Esc fire (unless a binding opts in with `allowInInputs`).
 */

export interface KeyChord {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface HotkeyOptions {
  /** Fire even when focus is in a text field. Mod combos and Esc always do. */
  allowInInputs?: boolean;
  /** Fire even while a modal dialog is open. Mod combos always do. */
  allowInModals?: boolean;
  /** Call preventDefault when handled (default true). */
  preventDefault?: boolean;
  /**
   * Higher wins when two bindings share keys (then newest wins). Commands bind at -1 so a
   * component's `useHotkey` (0) can take over a global key while it is mounted.
   */
  priority?: number;
}

/** Return `false` to let the next (older) binding for the same keys handle it. */
export type HotkeyHandler = (event: KeyboardEvent) => void | boolean;

interface Binding {
  id: number;
  sequence: KeyChord[];
  handler: HotkeyHandler;
  options: HotkeyOptions;
}

export const SEQUENCE_TIMEOUT_MS = 1000;

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  escape: 'escape',
  space: ' ',
  spacebar: ' ',
  return: 'enter',
  '↵': 'enter',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  '↑': 'arrowup',
  '↓': 'arrowdown',
  del: 'delete',
};

const normalizeKey = (key: string): string => {
  const k = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  return KEY_ALIASES[k] ?? k;
};

/** Letters, digits and named keys compare Shift; symbols ("?", "[") already encode it. */
const shiftMatters = (key: string) => key.length > 1 || /^[a-z0-9]$/.test(key);

export const parseChord = (raw: string): KeyChord => {
  let text = raw.trim();
  const chord: KeyChord = { key: '', mod: false, shift: false, alt: false };
  // Mac glyph forms: "⌘K", "⇧⌘P", "⌥X"
  const glyphs: [string, keyof Omit<KeyChord, 'key'>][] = [
    ['⌘', 'mod'],
    ['⌃', 'mod'],
    ['⇧', 'shift'],
    ['⌥', 'alt'],
  ];
  let changed = true;
  while (changed && text.length > 1) {
    changed = false;
    for (const [g, flag] of glyphs) {
      if (text.startsWith(g)) {
        chord[flag] = true;
        text = text.slice(g.length);
        changed = true;
      }
    }
  }
  const parts = text.length > 1 ? text.split('+') : [text];
  // "Shift++" style: an empty trailing part means the key itself is "+"
  if (parts.length > 1 && parts[parts.length - 1] === '') parts[parts.length - 1] = '+';
  for (const part of parts.slice(0, -1)) {
    const p = part.trim().toLowerCase();
    if (p === 'mod' || p === 'cmd' || p === 'meta' || p === 'ctrl' || p === 'control') chord.mod = true;
    else if (p === 'shift') chord.shift = true;
    else if (p === 'alt' || p === 'option' || p === 'opt') chord.alt = true;
  }
  chord.key = normalizeKey(parts[parts.length - 1] ?? '');
  return chord;
};

/** "G I" → two chords; ["G", "I"] → two chords; "Mod+K" → one chord. */
export const parseHotkey = (keys: string | readonly string[]): KeyChord[] => {
  const list =
    typeof keys === 'string'
      ? keys.trim() === ''
        ? []
        : keys.trim() === ' '
          ? [' ']
          : keys.trim().split(/\s+/)
      : keys;
  return list.filter((k) => k.length > 0).map(parseChord);
};

export const chordFromEvent = (
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): KeyChord => ({
  key: normalizeKey(e.key),
  mod: e.metaKey || e.ctrlKey,
  shift: e.shiftKey,
  alt: e.altKey,
});

export const chordMatches = (expected: KeyChord, actual: KeyChord): boolean =>
  expected.key === actual.key &&
  expected.mod === actual.mod &&
  expected.alt === actual.alt &&
  (!shiftMatters(expected.key) || expected.shift === actual.shift);

/** True when the event comes from somewhere the person is typing. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
  }
  return (
    target.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]') !==
    null
  );
};

const isModalOpen = (doc: Document | undefined): boolean =>
  !!doc?.querySelector('[aria-modal="true"]:not([data-hotkeys-passthrough])');

/** Popovers and menus (`data-ht-layer`) own their keys while focus is inside them. */
const isInsideLayer = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-ht-layer]:not([data-hotkeys-passthrough])') !== null;

/** Display form for Kbd: "Mod+K" → "⌘K" on macOS, "Ctrl K" elsewhere. */
export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const formatChord = (raw: string): string => {
  const c = parseChord(raw);
  const mac = isMac();
  const key =
    c.key === ' '
      ? 'Space'
      : c.key === 'escape'
        ? 'Esc'
        : c.key === 'enter'
          ? '↵'
          : c.key.length === 1
            ? c.key.toUpperCase()
            : c.key[0]!.toUpperCase() + c.key.slice(1);
  return `${c.mod ? (mac ? '⌘' : 'Ctrl+') : ''}${c.shift && shiftMatters(c.key) ? (mac ? '⇧' : 'Shift+') : ''}${c.alt ? (mac ? '⌥' : 'Alt+') : ''}${key}`;
};

export class HotkeyService {
  private bindings: Binding[] = [];
  private nextId = 1;
  private pending: { chord: KeyChord; at: number } | null = null;
  private detach: (() => void) | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {}

  attach(target: Window | Document | HTMLElement = window): () => void {
    this.detach?.();
    const listener = (e: Event) => this.handle(e as KeyboardEvent);
    target.addEventListener('keydown', listener);
    this.detach = () => target.removeEventListener('keydown', listener);
    return () => {
      this.detach?.();
      this.detach = null;
    };
  }

  register(
    keys: string | readonly string[],
    handler: HotkeyHandler,
    options: HotkeyOptions = {},
  ): () => void {
    const sequence = parseHotkey(keys);
    if (sequence.length === 0) return () => undefined;
    const id = this.nextId++;
    this.bindings.push({ id, sequence, handler, options });
    return () => {
      this.bindings = this.bindings.filter((b) => b.id !== id);
    };
  }

  /** Bindings currently registered (for the shortcut sheet and tests). */
  get size(): number {
    return this.bindings.length;
  }

  handle(e: KeyboardEvent): boolean {
    if (e.isComposing || e.repeat || e.defaultPrevented) return false;
    if (['shift', 'meta', 'control', 'alt'].includes(normalizeKey(e.key))) return false;
    const chord = chordFromEvent(e);
    const typing = isTypingTarget(e.target);
    const modal =
      isModalOpen(typeof document !== 'undefined' ? document : undefined) || isInsideLayer(e.target);

    const eligible = (b: Binding, last: KeyChord) => {
      if (last.mod) return true;
      if (last.key === 'escape') return !modal || !!b.options.allowInModals;
      if (typing && !b.options.allowInInputs) return false;
      if (modal && !b.options.allowInModals) return false;
      return true;
    };

    // Highest priority first, then newest, so a page can override a global key.
    const ordered = [...this.bindings].sort(
      (a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0) || b.id - a.id,
    );

    // 1) Complete a pending sequence.
    if (this.pending && this.now() - this.pending.at <= SEQUENCE_TIMEOUT_MS) {
      const first = this.pending.chord;
      this.pending = null;
      for (const b of ordered) {
        if (
          b.sequence.length === 2 &&
          chordMatches(b.sequence[0]!, first) &&
          chordMatches(b.sequence[1]!, chord) &&
          eligible(b, chord)
        ) {
          if (this.fire(b, e)) return true;
        }
      }
    }
    this.pending = null;

    // 2) Start a sequence: the key is the first chord of some two-key binding.
    const starts = ordered.some(
      (b) => b.sequence.length === 2 && chordMatches(b.sequence[0]!, chord) && eligible(b, chord),
    );
    if (starts) {
      this.pending = { chord, at: this.now() };
      return false;
    }

    // 3) Single chord.
    for (const b of ordered) {
      if (b.sequence.length === 1 && chordMatches(b.sequence[0]!, chord) && eligible(b, chord)) {
        if (this.fire(b, e)) return true;
      }
    }
    return false;
  }

  private fire(b: Binding, e: KeyboardEvent): boolean {
    const result = b.handler(e);
    if (result === false) return false;
    if (b.options.preventDefault !== false) e.preventDefault();
    return true;
  }
}

/** The app-wide instance, attached once by HotkeysProvider. */
export const hotkeys = new HotkeyService();
