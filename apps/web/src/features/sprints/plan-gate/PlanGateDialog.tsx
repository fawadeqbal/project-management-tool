import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Icon } from '@hearth/ui';
import { usePlanGateStore } from './plan-gate-store';
import styles from './plan-gate.module.css';

/** Explains what the locked feature does (copy from the API) and offers plans — never a dead end. */
export function PlanGateDialog() {
  const dialog = usePlanGateStore((s) => s.dialog);
  const close = usePlanGateStore((s) => s.close);
  const navigate = useNavigate();
  return (
    <Dialog
      open={!!dialog}
      onClose={close}
      size="sm"
      title="Upgrade to keep going"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <Button
            onClick={() => {
              close();
              void navigate('/settings/billing');
            }}
          >
            See plans
          </Button>
        </>
      }
    >
      <p className={styles.message}>
        <Icon name="sparkles" className={styles.icon} />
        <span>{dialog?.message}</span>
      </p>
      <p className={styles.note}>You can keep looking around — nothing you’ve planned is lost.</p>
    </Dialog>
  );
}
