import { useState } from 'react';
import { Button, Icon } from '@hearth/ui';
import { usePermission } from '@/shared/auth';
import { useToast } from '@/shared/toast';
import { downloadExport } from '@/features/billing';
import styles from '../settings.module.css';

/** Settings → Import / export: a full JSON export of projects and tasks. */
export function ImportExportPage() {
  const canExport = usePermission('workspace.manage');
  const [busy, setBusy] = useState(false);
  const { show } = useToast();
  const run = async () => {
    setBusy(true);
    try {
      await downloadExport();
      show({ message: 'Export downloaded — every project and task as JSON.' });
    } catch (e) {
      show({
        message: e instanceof Error ? e.message : 'The export didn’t finish. Try again.',
        tone: 'danger',
        icon: 'alert',
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Import / export</h1>
        <p className={styles.subtitle}>Your data is yours. Take it with you any time — on every plan.</p>
      </div>
      <section className={styles.card} aria-labelledby="export-heading">
        <h2 id="export-heading" className={styles.cardTitle}>
          Export workspace
        </h2>
        <p className={styles.muted}>
          Projects, sections and every task (status, dates, assignee, description) in one JSON file.
        </p>
        <div>
          <Button
            icon="archive"
            onClick={() => void run()}
            loading={busy}
            disabled={!canExport}
            title={canExport ? undefined : 'Only admins and owners can export'}
          >
            Download export
          </Button>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="import-heading">
        <h2 id="import-heading" className={styles.cardTitle}>
          Import
        </h2>
        <p className={styles.muted}>
          <Icon name="clock" size={12} /> Importing from Asana, Trello and CSV is coming soon. Meanwhile, a
          template gets you started in seconds.
        </p>
      </section>
    </div>
  );
}
