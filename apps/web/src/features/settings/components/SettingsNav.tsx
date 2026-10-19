import { NavLink } from 'react-router-dom';
import styles from '../settings.module.css';

export interface SettingsSection {
  path: string;
  label: string;
  /** Built screens; the rest show a calm "Coming soon". */
  ready?: boolean;
}

export const SETTINGS_NAV: { heading: string; items: SettingsSection[] }[] = [
  {
    heading: 'Account',
    items: [
      { path: 'profile', label: 'Profile', ready: true },
      { path: 'notifications', label: 'Notifications' },
      { path: 'appearance', label: 'Appearance', ready: true },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { path: 'general', label: 'General' },
      { path: 'members', label: 'Members', ready: true },
      { path: 'teams', label: 'Teams' },
      { path: 'fields', label: 'Custom fields & statuses' },
      { path: 'integrations', label: 'Integrations' },
      { path: 'import-export', label: 'Import / export', ready: true },
    ],
  },
  {
    heading: 'Admin',
    items: [
      { path: 'security', label: 'Security & SSO' },
      { path: 'audit-log', label: 'Audit log' },
      { path: 'billing', label: 'Billing', ready: true },
    ],
  },
];

export const ALL_SETTINGS_SECTIONS = SETTINGS_NAV.flatMap((g) => g.items);

/** Left nav from Roles.dc.html: Account / Workspace / Admin. */
export function SettingsNav() {
  return (
    <nav aria-label="Settings" className={styles.nav}>
      {SETTINGS_NAV.map((group) => (
        <div key={group.heading} className={styles.navGroup}>
          <h2 className={styles.navHeading}>{group.heading}</h2>
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={`/settings/${item.path}`}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
