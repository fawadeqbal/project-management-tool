import type { PlanCardDto } from '@hearth/contracts';
import { Button, Dialog, Icon } from '@hearth/ui';
import styles from '../billing.module.css';

export interface DowngradeDialogProps {
  plan: PlanCardDto | null;
  currentPlanName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Downgrades are always reachable — this only makes sure nobody loses features by surprise. */
export function DowngradeDialog({ plan, currentPlanName, busy, onConfirm, onClose }: DowngradeDialogProps) {
  return (
    <Dialog
      open={!!plan}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      title={plan ? `Move from ${currentPlanName} to ${plan.name}?` : ''}
      description="Your projects, tasks and history stay. These features turn off right away:"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep {currentPlanName}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            Downgrade to {plan?.name}
          </Button>
        </>
      }
    >
      {plan?.lostFeatures.length ? (
        <ul className={styles.lostList} aria-label="Features you’d lose">
          {plan.lostFeatures.map((f) => (
            <li key={f.id}>
              <Icon name="x" />
              {f.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.dialogText}>Nothing you use today turns off.</p>
      )}
    </Dialog>
  );
}
