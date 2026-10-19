import { useState } from 'react';
import type { BillingDto } from '@hearth/contracts';
import { Button, Dialog, SegmentedControl } from '@hearth/ui';
import { useToast } from '@/shared/toast';
import { billingApi, downloadExport, useBillingMutation } from '../api';
import styles from '../billing.module.css';

type Modal = 'pause' | 'cancel' | null;

/** "Need a break?" — pause, export and cancel are always visible, never buried. */
export function PauseCancel({ billing }: { billing: BillingDto }) {
  const [modal, setModal] = useState<Modal>(null);
  const [months, setMonths] = useState<'1' | '2' | '3'>('1');
  const { show } = useToast();
  const pause = useBillingMutation((m: 1 | 2 | 3) => billingApi.pause(m));
  const resume = useBillingMutation(() => billingApi.resume());
  const cancel = useBillingMutation(() => billingApi.cancel());
  const { current, canManage } = billing;
  const fail = (e: { message: string }) => show({ message: e.message, tone: 'danger', icon: 'alert' });

  const exportData = () =>
    downloadExport()
      .then(() => show({ message: 'Export downloaded — every project and task as JSON.', icon: 'check' }))
      .catch((e: Error) => fail(e));

  return (
    <>
      <p className={styles.footer}>
        {current.status === 'ACTIVE' ? (
          <>
            Need a break?{' '}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setModal('pause')}
              disabled={!canManage}
            >
              Pause billing for up to 3 months
            </button>
            {' · '}
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.linkButton}
              disabled={!canManage || resume.isPending}
              onClick={() =>
                resume.mutate(undefined, {
                  onSuccess: () => show({ message: 'Billing is active again.' }),
                  onError: fail,
                })
              }
            >
              {current.status === 'PAUSED' ? 'Resume billing now' : `Keep ${current.planName}`}
            </button>
            {' · '}
          </>
        )}
        <button type="button" className={styles.linkButton} onClick={exportData}>
          Export all data
        </button>
        {current.status !== 'CANCELED' && current.plan !== 'FREE' ? (
          <>
            {' · '}
            <button
              type="button"
              className={`${styles.linkButton} ${styles.linkButtonQuiet}`}
              onClick={() => setModal('cancel')}
              disabled={!canManage}
            >
              Cancel plan
            </button>
          </>
        ) : null}
      </p>

      <Dialog
        open={modal === 'pause'}
        onClose={() => setModal(null)}
        size="sm"
        title="Pause billing"
        description="Your workspace stays readable and nothing is deleted. Billing restarts automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Keep billing
            </Button>
            <Button
              loading={pause.isPending}
              onClick={() =>
                pause.mutate(Number(months) as 1 | 2 | 3, {
                  onSuccess: () => {
                    setModal(null);
                    show({
                      message: `Billing paused for ${months} month${months === '1' ? '' : 's'}.`,
                      action: 'Undo',
                      onAction: () => resume.mutate(undefined),
                    });
                  },
                  onError: fail,
                })
              }
            >
              Pause for {months} month{months === '1' ? '' : 's'}
            </Button>
          </>
        }
      >
        <SegmentedControl
          className={styles.pauseOptions}
          label="Pause length"
          value={months}
          onChange={(v) => setMonths(v as '1' | '2' | '3')}
          options={[
            { id: '1', label: '1 month' },
            { id: '2', label: '2 months' },
            { id: '3', label: '3 months' },
          ]}
        />
      </Dialog>

      <Dialog
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        role="alertdialog"
        size="sm"
        title={`Cancel ${current.planName}?`}
        description={`You keep ${current.planName} until ${current.renewsLabel}, then move to Free. You can change your mind until then.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal('pause')}>
              Pause instead
            </Button>
            <Button variant="secondary" icon="archive" onClick={exportData}>
              Export your data
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(undefined, {
                  onSuccess: () => {
                    setModal(null);
                    show({ message: `${current.planName} ends ${current.renewsLabel}.`, tone: 'info' });
                  },
                  onError: fail,
                })
              }
            >
              Cancel plan
            </Button>
          </>
        }
      />
    </>
  );
}
