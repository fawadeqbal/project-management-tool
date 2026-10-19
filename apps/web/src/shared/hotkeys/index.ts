export {
  HotkeyService,
  hotkeys,
  parseHotkey,
  parseChord,
  chordMatches,
  isTypingTarget,
  formatChord,
  isMac,
  SEQUENCE_TIMEOUT_MS,
  type HotkeyHandler,
  type HotkeyOptions,
  type KeyChord,
} from './hotkey-service';
export { useHotkey, type UseHotkeyOptions } from './use-hotkey';
