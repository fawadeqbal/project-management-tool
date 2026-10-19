import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { SettingsNav } from './SettingsNav';
import styles from '../settings.module.css';

/** Settings nav + content. Used as the `settings` layout route and by the billing route. */
export function SettingsFrame({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.frame}>
      <SettingsNav />
      <div className={styles.content}>{children ?? <Outlet />}</div>
    </div>
  );
}
