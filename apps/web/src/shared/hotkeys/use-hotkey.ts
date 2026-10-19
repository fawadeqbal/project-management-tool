import { useEffect, useRef } from 'react';
import { hotkeys, type HotkeyHandler, type HotkeyOptions } from './hotkey-service';

export interface UseHotkeyOptions extends HotkeyOptions {
  enabled?: boolean;
}

/**
 * Binds a shortcut while the component is mounted:
 *   useHotkey('J', () => moveFocus(1));
 *   useHotkey(['G', 'I'], () => navigate('/inbox'));
 *   useHotkey('Mod+Enter', send, { allowInInputs: true });
 */
export function useHotkey(
  keys: string | readonly string[],
  handler: HotkeyHandler,
  options: UseHotkeyOptions = {},
) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const { enabled = true, allowInInputs, allowInModals, preventDefault, priority } = options;
  const id = typeof keys === 'string' ? keys : keys.join(' ');
  useEffect(() => {
    if (!enabled) return;
    return hotkeys.register(id, (e) => ref.current(e), {
      allowInInputs,
      allowInModals,
      preventDefault,
      priority,
    });
  }, [id, enabled, allowInInputs, allowInModals, preventDefault, priority]);
}
