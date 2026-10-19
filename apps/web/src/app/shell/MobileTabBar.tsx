import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '@hearth/ui';
import { useUiStore } from '@/shared/layout/ui-store';
import { useToastStore } from '@/shared/toast';
import { useShell } from '@/shared/workspace/hooks';
import styles from './mobile-tabbar.module.css';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/my-tasks', label: 'My tasks', icon: 'my-tasks' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
];

/**
 * Phone navigation (MobileTasks.dc.html): Home · My tasks · Inbox · Search within thumb reach,
 * plus a floating "+" that opens the create-task dialog. The shell mounts it below 768px only.
 */
export function MobileTabBar() {
  const openPalette = useUiStore((s) => s.openPalette);
  const paletteOpen = useUiStore((s) => s.palette.open);
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const { data: shell } = useShell();
  const unread = shell?.counts.inbox ?? 0;
  // Lift the + above any toast so Undo stays tappable (and the button stays visible).
  const toasts = useToastStore((s) => s.toasts.length);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        style={{ '--fab-lift': `${toasts * 48}px` } as CSSProperties}
        aria-label="Create task"
        aria-haspopup="dialog"
        onClick={() => openCreateTask()}
      >
        <Icon name="plus" size={24} />
      </button>
      <nav aria-label="Tabs" className={styles.bar}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={styles.tab}
            aria-label={tab.to === '/inbox' && unread ? `Inbox, ${unread} unread` : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon name={tab.icon} size={24} />
              {tab.to === '/inbox' && unread ? (
                <span className={styles.badge} aria-hidden="true">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={styles.tab}
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          data-active={paletteOpen || undefined}
          onClick={() => openPalette()}
        >
          <span className={styles.iconWrap}>
            <Icon name="search" size={24} />
          </span>
          <span>Search</span>
        </button>
      </nav>
    </>
  );
}
