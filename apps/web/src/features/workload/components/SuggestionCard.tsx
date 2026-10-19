import { Button, Icon } from '@hearth/ui';
import type { RebalanceSuggestionDto } from '@hearth/contracts';
import { firstName } from '../lib/workload-format';
import styles from '../workload.module.css';

/** The AI's rebalance proposal: labelled as a suggestion, names its source, never applied automatically. */
export function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: RebalanceSuggestionDto;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const s = suggestion;
  return (
    <section className={styles.suggestion} aria-label="Suggestion">
      <Icon name="sparkles" className={styles.suggestionIcon} />
      <p className={styles.suggestionText}>
        <strong className={styles.suggestionLabel}>Suggestion:</strong> move{' '}
        <strong>
          {s.task.key} {s.task.title}
        </strong>{' '}
        ({s.hours}h) from {firstName(s.from.name)} to {firstName(s.to.name)} on {s.dayLabel}.{' '}
        {firstName(s.from.name)} drops to {s.fromLoadPctAfter}%, {firstName(s.to.name)} rises to{' '}
        {s.toLoadPctAfter}%. <span className={styles.source}>Suggested {s.source}.</span>
      </p>
      <Button size="sm" onClick={onAccept}>
        Accept
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </section>
  );
}
