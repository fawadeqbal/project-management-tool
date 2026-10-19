import { useLocation, useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '@hearth/ui';
import { ALL_SETTINGS_SECTIONS } from '../components/SettingsNav';
import styles from '../settings.module.css';

/** Calm placeholder for settings sections that aren't built yet. */
export function ComingSoonSettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = ALL_SETTINGS_SECTIONS.find((s) => pathname.endsWith(`/${s.path}`));
  const label = section?.label ?? 'This section';
  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>{label}</h1>
      <EmptyState
        icon="settings"
        title={`${label} is coming soon`}
        description="We’re building this next. Everything else in Settings works today."
        primaryAction={
          <Button variant="secondary" onClick={() => void navigate('/settings/members')}>
            Go to Members
          </Button>
        }
      />
    </div>
  );
}
