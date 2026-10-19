import { Dialog, Kbd } from '@hearth/ui';
import { isMac } from '@/shared/hotkeys/hotkey-service';
import { useUiStore } from '@/shared/layout/ui-store';
import styles from './shell.module.css';

interface Shortcut {
  keys: string[];
  label: string;
}

const mod = () => (isMac() ? '⌘' : 'Ctrl');

const sections = (): { title: string; items: Shortcut[] }[] => [
  {
    title: 'Anywhere',
    items: [
      { keys: [`${mod()} K`], label: 'Open command palette' },
      { keys: ['/'], label: 'Search' },
      { keys: ['C'], label: 'Create task' },
      { keys: ['['], label: 'Toggle sidebar' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['G', 'H'], label: 'Home' },
      { keys: ['G', 'M'], label: 'My tasks' },
      { keys: ['G', 'I'], label: 'Inbox' },
      { keys: ['G', 'D'], label: 'Dashboards' },
      { keys: ['1–8'], label: 'Switch view' },
    ],
  },
  {
    title: 'In a list',
    items: [
      { keys: ['J', 'K'], label: 'Move down / up' },
      { keys: ['X'], label: 'Select' },
      { keys: ['Space'], label: 'Complete' },
      { keys: ['↵'], label: 'Open task' },
      { keys: ['S'], label: 'Change status' },
      { keys: ['A'], label: 'Change assignee' },
      { keys: ['P'], label: 'Change priority' },
    ],
  },
  {
    title: 'In a task',
    items: [
      { keys: ['Esc'], label: 'Close panel' },
      { keys: [`${mod()} ↵`], label: 'Send comment' },
    ],
  },
];

/** The keyboard map (?). */
export function ShortcutSheet() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" description="Hearth is built to be driven from the keyboard." size="lg">
      <div className={styles.sheet}>
        {sections().map((section) => (
          <section key={section.title} aria-labelledby={`keys-${section.title}`}>
            <h3 id={`keys-${section.title}`} className={styles.sheetTitle}>
              {section.title}
            </h3>
            <dl className={styles.sheetList}>
              {section.items.map((s) => (
                <div key={s.label} className={styles.sheetRow}>
                  <dt>{s.label}</dt>
                  <dd>
                    <Kbd keys={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
