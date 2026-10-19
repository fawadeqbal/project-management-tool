import { SegmentedControl } from '@hearth/ui';
import { useTheme, type ThemePreference } from '@/shared/theme';
import styles from '../settings.module.css';

const OPTIONS = [
  { id: 'light', label: 'Light', icon: 'sun' as const },
  { id: 'dark', label: 'Dark', icon: 'moon' as const },
  { id: 'system', label: 'System', icon: 'settings' as const },
];

/** Settings → Appearance. Switches live; the provider saves it to the profile (PATCH /me). */
export function AppearancePage() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Appearance</h1>
        <p className={styles.subtitle}>Your choice follows you to every device you sign in on.</p>
      </div>
      <section className={styles.card} aria-labelledby="theme-heading">
        <h2 id="theme-heading" className={styles.cardTitle}>
          Theme
        </h2>
        <SegmentedControl label="Theme" options={OPTIONS} value={preference} onChange={(v) => setPreference(v as ThemePreference)} />
        <p className={styles.muted} aria-live="polite">
          {preference === 'system' ? `Following your system — ${resolved} right now.` : `Always ${resolved}.`} Toggle any time from ⌘K with “Toggle theme”.
        </p>
      </section>
    </div>
  );
}
