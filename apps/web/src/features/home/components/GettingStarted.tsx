import type { OnboardingDto, OnboardingStepDto } from '@hearth/contracts';
import { Button, ProgressBar, Skeleton, TaskCheckbox } from '@hearth/ui';
import styles from '../home.module.css';

export interface GettingStartedProps {
  data: OnboardingDto | undefined;
  onInvite: () => void;
  onConnectSlack: () => void;
  onTemplate: () => void;
  onCreateTask: () => void;
}

/** Checklist with visible progress; done steps stay struck through; one highlighted next step. */
export function GettingStarted({ data, onInvite, onConnectSlack, onTemplate, onCreateTask }: GettingStartedProps) {
  if (!data)
    return (
      <section aria-label="Getting started" className={`${styles.card} ${styles.checklist}`}>
        <Skeleton width={180} height={26} />
        <Skeleton height={8} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={52} radius={10} />
        ))}
      </section>
    );

  const action = (s: OnboardingStepDto) => {
    if (s.done) return null;
    const variant = s.isNext ? 'primary' : 'secondary';
    switch (s.id) {
      case 'invite-teammates':
        return (
          <Button variant={variant} icon="users" onClick={onInvite}>
            Invite
          </Button>
        );
      case 'connect-slack':
        return (
          <Button variant={variant} onClick={onConnectSlack}>
            Connect
          </Button>
        );
      case 'start-from-template':
        return (
          <Button variant={variant} icon="layers" onClick={onTemplate}>
            Pick one
          </Button>
        );
      case 'create-first-task':
        return (
          <Button variant={variant} icon="plus" onClick={onCreateTask}>
            Create
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <section aria-labelledby="getting-started" className={`${styles.card} ${styles.checklist}`}>
      <div className={styles.checklistHead}>
        <h2 id="getting-started" className={styles.h2}>
          Getting started
        </h2>
        <span className={styles.count}>
          {data.completed} of {data.total} done
        </span>
      </div>
      <ProgressBar value={Math.round((data.completed / data.total) * 100)} height={8} label="Getting started" />
      <ol className={styles.steps}>
        {data.steps.map((s) => (
          <li key={s.id} className={`${styles.step} ${s.isNext ? styles.stepNext : ''}`} aria-current={s.isNext ? 'step' : undefined} data-next={s.isNext || undefined}>
            <TaskCheckbox checked={s.done} label={s.done ? `${s.title} (done)` : s.title} disabled tabIndex={-1} aria-hidden="true" />
            <div className={styles.stepText}>
              <span className={s.done ? styles.stepTitleDone : styles.stepTitle}>
                {s.title}
                {s.done ? <span className={styles.srOnly}> — done</span> : null}
                {s.isNext ? <span className={styles.srOnly}> — next step</span> : null}
              </span>
              <span className={styles.stepHint}>{s.hint}</span>
            </div>
            {action(s)}
          </li>
        ))}
      </ol>
    </section>
  );
}
