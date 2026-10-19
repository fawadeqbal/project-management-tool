import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Icon, Skeleton } from '@hearth/ui';
import { ApiError } from '@/shared/api/http';
import { useFeatureLimit } from '../api';
import styles from '../billing.module.css';

export interface UpgradePromptProps {
  open: boolean;
  /** Plan feature id, e.g. 'dashboards' or 'sprints'. Omit for metered limits (seats, runs). */
  feature?: string | null;
  onClose: () => void;
  /** "Keep previewing" leaves the person on the screen in read-only mode. Omit to show "Not now". */
  onPreview?: () => void;
  /** The 402 message from the API (already written for people). */
  message?: string;
}

const planWord = (id: string) => id.charAt(0) + id.slice(1).toLowerCase();

/**
 * Contextual upgrade prompt (Billing & plan limit): what the locked feature does, which plan
 * unlocks it, and a way to keep previewing — never a dead end.
 */
export function UpgradePrompt({ open, feature, onClose, onPreview, message }: UpgradePromptProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useFeatureLimit(open && feature ? feature : null);
  const title = feature
    ? data
      ? `${data.featureName} is part of ${data.requiredPlanName}`
      : 'Unlock this feature'
    : 'You’ve reached a plan limit';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {onPreview ? (
            <Button
              variant="secondary"
              icon="eye"
              onClick={() => {
                onPreview();
                onClose();
              }}
            >
              Keep previewing
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Not now
            </Button>
          )}
          <Button
            icon="arrow-up-right"
            onClick={() => {
              onClose();
              void navigate('/settings/billing');
            }}
          >
            See plans
          </Button>
        </>
      }
    >
      <div className={styles.promptBody}>
        <span className={styles.promptIcon} aria-hidden="true">
          <Icon name="sparkles" size={20} />
        </span>
        {feature ? (
          isLoading || !data ? (
            <Skeleton width="100%" height={40} />
          ) : (
            <p className={styles.promptPitch}>
              {data.pitch} You’re on {planWord(data.currentPlan)}; {data.requiredPlanName} includes it.
              Preview it here before you decide.
            </p>
          )
        ) : null}
        {message ? <p className={feature ? styles.promptNote : styles.promptPitch}>{message}</p> : null}
      </div>
    </Dialog>
  );
}

interface PromptState {
  open: boolean;
  feature?: string | null;
  message?: string;
}

export interface UpgradePromptApi {
  /** Open for a feature id ('dashboards') or, without one, a metered-limit message. */
  open: (feature: string | null, message?: string) => void;
  /** For a mutation's onError: opens on a 402 and returns true, otherwise returns false. */
  handleError: (error: unknown) => boolean;
  close: () => void;
  /** Render this once in the component tree. */
  element: ReactNode;
}

/**
 * `const upgrade = useUpgradePrompt({ onPreview })`, then `if (!upgrade.handleError(err)) toast(...)`
 * in onError and `{upgrade.element}` in the JSX.
 */
export function useUpgradePrompt(opts: { onPreview?: () => void } = {}): UpgradePromptApi {
  const [state, setState] = useState<PromptState>({ open: false });
  const open = useCallback(
    (feature: string | null, message?: string) => setState({ open: true, feature, message }),
    [],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const handleError = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.kind !== 'limit_reached') return false;
    const feature = typeof error.details?.feature === 'string' ? error.details.feature : null;
    setState({ open: true, feature, message: feature ? undefined : error.message });
    return true;
  }, []);
  const { onPreview } = opts;
  const element = useMemo(
    () => (
      <UpgradePrompt
        open={state.open}
        feature={state.feature}
        message={state.message}
        onClose={close}
        onPreview={onPreview}
      />
    ),
    [state, close, onPreview],
  );
  return { open, handleError, close, element };
}
