import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu, Icon, NavItem, ProgressBar, type IconName } from '@hearth/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useShell } from '@/shared/workspace/hooks';
import { useUiStore } from '@/shared/layout/ui-store';
import styles from './shell.module.css';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  count?: number;
  /** Paths that also light this item up. */
  match?: string[];
}

const isActive = (pathname: string, entry: NavEntry) =>
  [entry.to, ...(entry.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

function WorkspaceSwitcher() {
  const me = useAuthStore((s) => s.me);
  const switchWorkspace = useAuthStore((s) => s.switchWorkspace);
  const client = useQueryClient();
  const navigate = useNavigate();
  if (!me) return null;
  const current = me.workspace;
  return (
    <DropdownMenu
      label="Workspaces"
      items={[
        {
          id: 'workspaces',
          heading: 'Switch workspace',
          items: me.workspaces.map((w) => ({
            id: w.id,
            label: w.name,
            icon: w.id === current.id ? ('check' as const) : undefined,
            hint: w.role.charAt(0) + w.role.slice(1).toLowerCase(),
            onSelect: () => {
              if (w.id === current.id) return;
              switchWorkspace(w.id);
              // Requests read the workspace header at send time, so refetching is enough.
              void client.resetQueries();
              void navigate('/my-tasks');
            },
          })),
        },
      ]}
      trigger={
        <button
          type="button"
          className={styles.workspace}
          aria-label={`Workspace: ${current.name}. Switch workspace`}
        >
          <span className={styles.workspaceMark} aria-hidden="true">
            {current.name.charAt(0).toUpperCase()}
          </span>
          <span className={styles.workspaceName}>{current.name}</span>
          <Icon name="chevron-down" className={styles.chevron} />
        </button>
      }
    />
  );
}

/** Sidebar per Sidebar.dc.html: workspace, primary nav, favorites, teams, getting started, settings. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { data: shell } = useShell();
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);

  const nav: NavEntry[] = [
    { to: '/home', label: 'Home', icon: 'home' },
    { to: '/my-tasks', label: 'My tasks', icon: 'my-tasks', count: shell?.counts.myTasks },
    { to: '/inbox', label: 'Inbox', icon: 'inbox', count: shell?.counts.inbox || undefined },
    { to: '/projects', label: 'Projects', icon: 'folder' },
    { to: '/goals', label: 'Goals', icon: 'target' },
    { to: '/docs', label: 'Docs', icon: 'doc' },
    { to: '/dashboards', label: 'Dashboards', icon: 'dashboard' },
  ];
  const onboarding = shell?.onboarding;
  const showOnboarding = !!onboarding && onboarding.total > 0 && onboarding.completed < onboarding.total;

  return (
    <nav aria-label="Main" className={styles.sidebar}>
      <WorkspaceSwitcher />
      <div className={styles.navGroup}>
        {nav.map((n) => (
          <NavItem
            key={n.to}
            linkComponent={Link}
            to={n.to}
            label={n.label}
            icon={n.icon}
            count={n.count}
            active={isActive(pathname, n)}
            onClick={onNavigate}
          />
        ))}
      </div>

      {shell?.favorites.length ? (
        <section className={styles.navSection} aria-labelledby="sidebar-favorites">
          <h2 id="sidebar-favorites" className={styles.sectionLabel}>
            Favorites
          </h2>
          {shell.favorites.map((p) => (
            <NavItem
              key={p.id}
              linkComponent={Link}
              to={`/projects/${p.id}`}
              label={p.name}
              dot={p.color}
              active={pathname.startsWith(`/projects/${p.id}`)}
              onClick={onNavigate}
            />
          ))}
        </section>
      ) : null}

      {shell?.teams.length ? (
        <section className={styles.navSection} aria-labelledby="sidebar-teams">
          <h2 id="sidebar-teams" className={styles.sectionLabel}>
            Teams
          </h2>
          {shell.teams.map((t) => (
            <NavItem
              key={t.id}
              linkComponent={Link}
              to={`/my-tasks?team=${t.id}`}
              label={t.name}
              dot={t.color}
              onClick={onNavigate}
            />
          ))}
        </section>
      ) : null}

      <div className={styles.spacer} />

      {showOnboarding ? (
        <Link to="/home" className={styles.onboarding} onClick={onNavigate}>
          <span className={styles.onboardingHead}>
            <span className={styles.onboardingTitle}>Getting started</span>
            <span className={styles.onboardingCount}>
              {onboarding.completed} of {onboarding.total}
            </span>
          </span>
          <ProgressBar
            value={Math.round((onboarding.completed / onboarding.total) * 100)}
            label="Getting started"
          />
          {onboarding.nextStep ? (
            <span className={styles.onboardingNext}>Next: {onboarding.nextStep} →</span>
          ) : null}
        </Link>
      ) : null}

      <div className={styles.navGroup}>
        <NavItem
          linkComponent={Link}
          to="/settings/members"
          label="Settings"
          icon="settings"
          active={pathname.startsWith('/settings')}
          onClick={onNavigate}
        />
        <NavItem
          linkComponent="button"
          type="button"
          label="Help & shortcuts"
          icon="help"
          onClick={() => {
            onNavigate?.();
            setShortcutsOpen(true);
          }}
        />
      </div>
    </nav>
  );
}
