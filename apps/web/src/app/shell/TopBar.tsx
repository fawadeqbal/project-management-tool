import { useMatches, useNavigate } from 'react-router-dom';
import { Avatar, Button, DropdownMenu, Icon, Kbd } from '@hearth/ui';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useMe } from '@/shared/auth/use-me';
import { useCommandRegistry } from '@/shared/commands/CommandsProvider';
import { isMac } from '@/shared/hotkeys/hotkey-service';
import { useUiStore } from '@/shared/layout/ui-store';
import { useTheme } from '@/shared/theme';
import { useShell } from '@/shared/workspace/hooks';
import { hasCrumb, resolveCrumb } from '@/shared/routing/crumbs';
import styles from './shell.module.css';

function Breadcrumb() {
  const matches = useMatches();
  const crumbs = matches.flatMap((m) => {
    if (!hasCrumb(m.handle) || m.handle.crumb === undefined) return [];
    const label = resolveCrumb(m.handle.crumb, { params: m.params, data: m.data, pathname: m.pathname });
    return label ? [{ id: m.id, label }] : [];
  });
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.id} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
            {c.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ProfileMenu() {
  const { data: me } = useMe();
  const { resolved, toggle } = useTheme();
  const registry = useCommandRegistry();
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const user = me?.user;
  if (!user) return null;
  return (
    <DropdownMenu
      label="Account"
      align="end"
      items={[
        {
          id: 'profile',
          heading: `${user.name} · ${user.email}`,
          items: [
            {
              id: 'theme',
              label: resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
              icon: resolved === 'dark' ? 'sun' : 'moon',
              onSelect: toggle,
            },
            {
              id: 'shortcuts',
              label: 'Keyboard shortcuts',
              icon: 'command',
              shortcut: '?',
              onSelect: () => setShortcutsOpen(true),
            },
          ],
        },
        {
          id: 'session',
          items: [
            {
              id: 'logout',
              label: 'Log out',
              icon: 'arrow-right',
              onSelect: () => void registry.run('app.logout'),
            },
          ],
        },
      ]}
      trigger={
        <button type="button" className={styles.avatarButton} aria-label={`Account menu for ${user.name}`}>
          <Avatar initials={user.initials} name={user.name} color={user.avatarColor} size={32} />
        </button>
      }
    />
  );
}

/** Top bar per TopBar.dc.html. Below 768px it keeps only menu, search, New and avatar. */
export function TopBar() {
  const navigate = useNavigate();
  const openPalette = useUiStore((s) => s.openPalette);
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const { data: shell } = useShell();
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const unread = shell?.counts.inbox ?? 0;
  const token = useAuthStore((s) => s.token);

  return (
    <header className={styles.topbar}>
      <Button
        variant="ghost"
        icon="list"
        className={styles.menuButton}
        aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar"
        onClick={() => setMobileNav(!mobileNavOpen)}
      />
      <Breadcrumb />
      <button
        type="button"
        className={styles.search}
        onClick={() => openPalette()}
        aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
      >
        <Icon name="search" />
        <span className={styles.searchLabel}>Search or jump to…</span>
        <Kbd keys={isMac() ? '⌘K' : 'Ctrl K'} className={styles.hideCompact} />
      </button>
      <Button
        variant="ghost"
        icon="sparkles"
        className={styles.hideCompact}
        onClick={() => openPalette({ mode: 'ai' })}
      >
        Ask Hearth
      </Button>
      <Button icon="plus" onClick={() => openCreateTask()} aria-keyshortcuts="C">
        <span className={styles.hideCompact}>New</span>
      </Button>
      <span className={styles.bellWrap}>
        <Button
          variant="ghost"
          icon="bell"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          onClick={() => void navigate('/inbox')}
          disabled={!token}
        />
        {unread ? (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </span>
      <Button
        variant="ghost"
        icon="help"
        aria-label="Help and keyboard shortcuts"
        className={styles.hideCompact}
        onClick={() => setShortcutsOpen(true)}
      />
      <ProfileMenu />
    </header>
  );
}
