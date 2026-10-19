import { useEffect, useRef, useState } from 'react';
import { Toast, isIconName, type IconName } from '@hearth/ui';
import { useToastStore, type ToastItem } from './toast-store';
import styles from './toast.module.css';

const iconFor = (item: ToastItem): IconName | undefined => {
  if (item.icon && isIconName(item.icon)) return item.icon;
  if (item.tone === 'danger') return 'alert';
  if (item.tone === 'info') return 'check';
  return undefined;
};

/** One toast with its own timer: pauses while hovered or focused, resumes on leave. */
function TimedToast({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.durationMs);
  const startedAt = useRef(0);

  useEffect(() => {
    remaining.current = item.durationMs;
  }, [item.durationMs, item.message]);

  useEffect(() => {
    if (paused || item.durationMs <= 0) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.id, item.durationMs, dismiss]);

  const handleAction = () => {
    item.onAction?.();
    dismiss(item.id);
  };

  return (
    <div
      className={styles.item}
      data-tone={item.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Toast
        message={item.message}
        action={item.action ?? false}
        icon={iconFor(item)}
        politeness={item.tone === 'danger' ? 'assertive' : 'polite'}
        onAction={handleAction}
        onDismiss={() => dismiss(item.id)}
      />
    </div>
  );
}

/** Stacked bottom-center; the live region always exists so screen readers hear new toasts. */
export function ToastRegion() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <section className={styles.region} aria-label="Notifications" aria-live="polite" aria-relevant="additions text">
      {toasts.map((t) => (
        <TimedToast key={t.id} item={t} />
      ))}
    </section>
  );
}
