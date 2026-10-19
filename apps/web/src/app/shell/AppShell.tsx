import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SkipLink } from '@hearth/ui';
import { CommandPalette } from '@/features/command-palette';
import { TaskPanelHost } from '@/features/task-detail';
import { useMe } from '@/shared/auth/use-me';
import { useUiStore } from '@/shared/layout/ui-store';
import { CreateTaskDialog } from '@/shared/tasks/CreateTaskDialog';
import { ShortcutSheet } from './ShortcutSheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './shell.module.css';

/** Off-canvas drawer behavior below 1024px: Esc closes, focus moves in and back out. */
function useDrawer() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNav);
  const { pathname } = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus?.();
    };
  }, [open, setOpen]);

  return { open, close: () => setOpen(false), drawerRef };
}

/**
 * The signed-in frame: skip link, sidebar, top bar, page outlet, and the hosts every page shares
 * (task panel via ?task=KEY, create-task dialog, ⌘K palette, shortcut sheet). Toasts live at the app root.
 */
export function AppShell() {
  useMe();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const drawer = useDrawer();

  // Let root-level overlays (toasts) center on the content column, not the window.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--shell-sidebar-width', collapsed ? '0px' : '256px');
    return () => void root.style.removeProperty('--shell-sidebar-width');
  }, [collapsed]);

  return (
    <div className={styles.shell} data-sidebar={collapsed ? 'collapsed' : 'expanded'} data-drawer={drawer.open ? 'open' : 'closed'}>
      <SkipLink targetId="main">Skip to content</SkipLink>
      <div id="app-sidebar" ref={drawer.drawerRef} className={styles.sidebarSlot}>
        <Sidebar onNavigate={drawer.open ? drawer.close : undefined} />
      </div>
      {drawer.open ? <div className={styles.scrim} aria-hidden="true" onClick={drawer.close} /> : null}
      <div className={styles.column}>
        <TopBar />
        <div className={styles.body}>
          <main id="main" tabIndex={-1} className={styles.main}>
            <Outlet />
          </main>
          <TaskPanelHost />
        </div>
      </div>
      <div id="mobile-tabbar-slot" />
      <CreateTaskDialog />
      <CommandPalette />
      <ShortcutSheet />
    </div>
  );
}
