import { useToastStore } from './toast-store';

export {
  toast,
  useToastStore,
  DEFAULT_TOAST_MS,
  type ToastOptions,
  type ToastItem,
  type ToastTone,
} from './toast-store';
export { ToastRegion } from './ToastRegion';

/**
 * `const { show } = useToast();`
 * `show({ message: 'HRT-129 marked as done', action: 'Undo', onAction: reopen })`
 */
export function useToast() {
  const show = useToastStore((s) => s.show);
  const dismiss = useToastStore((s) => s.dismiss);
  return { show, dismiss };
}
