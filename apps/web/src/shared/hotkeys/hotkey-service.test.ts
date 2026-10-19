import { describe, expect, it, vi } from 'vitest';
import { HotkeyService, isTypingTarget, parseHotkey, SEQUENCE_TIMEOUT_MS } from './hotkey-service';

const press = (svc: HotkeyService, key: string, init: Partial<KeyboardEventInit> = {}, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  svc.handle(e);
  return e;
};

describe('parseHotkey', () => {
  it('parses single keys, sequences and modifier combos', () => {
    expect(parseHotkey('C')).toEqual([{ key: 'c', mod: false, shift: false, alt: false }]);
    expect(parseHotkey('G I').map((c) => c.key)).toEqual(['g', 'i']);
    expect(parseHotkey(['G', 'M']).map((c) => c.key)).toEqual(['g', 'm']);
    expect(parseHotkey('Mod+K')).toEqual([{ key: 'k', mod: true, shift: false, alt: false }]);
    expect(parseHotkey('⌘K')[0]).toMatchObject({ key: 'k', mod: true });
    expect(parseHotkey('Esc')[0]!.key).toBe('escape');
    expect(parseHotkey('Space')[0]!.key).toBe(' ');
    expect(parseHotkey('?')[0]!.key).toBe('?');
  });
});

describe('HotkeyService', () => {
  it('fires single keys and Mod combos (Ctrl or Meta)', () => {
    const svc = new HotkeyService();
    const c = vi.fn();
    const k = vi.fn();
    svc.register('C', c);
    svc.register('Mod+K', k);
    press(svc, 'c');
    press(svc, 'k', { ctrlKey: true });
    press(svc, 'k', { metaKey: true });
    expect(c).toHaveBeenCalledTimes(1);
    expect(k).toHaveBeenCalledTimes(2);
  });

  it('completes a two-key sequence within the window', () => {
    let now = 0;
    const svc = new HotkeyService(() => now);
    const inbox = vi.fn();
    svc.register(['G', 'I'], inbox);
    press(svc, 'g');
    now += 400;
    press(svc, 'i');
    expect(inbox).toHaveBeenCalledTimes(1);
  });

  it('drops a sequence after the 1s window', () => {
    let now = 0;
    const svc = new HotkeyService(() => now);
    const inbox = vi.fn();
    svc.register('G I', inbox);
    press(svc, 'g');
    now += SEQUENCE_TIMEOUT_MS + 1;
    press(svc, 'i');
    expect(inbox).not.toHaveBeenCalled();
  });

  it('does not fire a single-key binding that is the second half of a sequence', () => {
    const svc = new HotkeyService(() => 0);
    const i = vi.fn();
    const gi = vi.fn();
    svc.register('I', i);
    svc.register('G I', gi);
    press(svc, 'g');
    press(svc, 'i');
    expect(gi).toHaveBeenCalledTimes(1);
    expect(i).not.toHaveBeenCalled();
    press(svc, 'i');
    expect(i).toHaveBeenCalledTimes(1);
  });

  it('ignores plain keys while typing, but lets Mod combos and Esc through', () => {
    const svc = new HotkeyService();
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const c = vi.fn();
    const k = vi.fn();
    const esc = vi.fn();
    svc.register('C', c);
    svc.register('Mod+K', k);
    svc.register('Esc', esc);
    for (const target of [input, area, editable]) {
      press(svc, 'c', {}, target);
      press(svc, 'k', { metaKey: true }, target);
      press(svc, 'Escape', {}, target);
    }
    expect(c).not.toHaveBeenCalled();
    expect(k).toHaveBeenCalledTimes(3);
    expect(esc).toHaveBeenCalledTimes(3);
  });

  it('can opt in to firing inside inputs', () => {
    const svc = new HotkeyService();
    const send = vi.fn();
    svc.register('Mod+Enter', send, { allowInInputs: true });
    press(svc, 'Enter', { ctrlKey: true }, document.createElement('textarea'));
    expect(send).toHaveBeenCalled();
  });

  it('prefers the newest binding and falls through when a handler returns false', () => {
    const svc = new HotkeyService();
    const older = vi.fn();
    const newer = vi.fn(() => false as const);
    svc.register('J', older);
    svc.register('J', newer);
    press(svc, 'j');
    expect(newer).toHaveBeenCalled();
    expect(older).toHaveBeenCalled();
  });

  it('prevents default only when handled, and unregisters cleanly', () => {
    const svc = new HotkeyService();
    const off = svc.register('C', () => undefined);
    expect(press(svc, 'c').defaultPrevented).toBe(true);
    off();
    expect(press(svc, 'c').defaultPrevented).toBe(false);
  });

  it('recognizes typing targets', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });
});
