import { Button, EmptyState, Kbd } from '@hearth/ui';
import styles from '../my-tasks.module.css';

/** Illustration from the Home design: two cards and a check, all tokens. */
function PlateIllustration() {
  return (
    <svg aria-hidden="true" width="160" height="120" viewBox="0 0 160 120" className={styles.illustration}>
      <circle cx="80" cy="60" r="60" style={{ fill: 'var(--brand-subtle)' }} />
      <rect
        x="34"
        y="34"
        width="96"
        height="26"
        rx="8"
        transform="rotate(5 82 47)"
        style={{ fill: 'var(--bg-surface)', stroke: 'var(--border-strong)', strokeWidth: 1.5 }}
      />
      <rect
        x="40"
        y="66"
        width="96"
        height="26"
        rx="8"
        style={{ fill: 'var(--bg-surface)', stroke: 'var(--border-strong)', strokeWidth: 1.5 }}
      />
      <rect x="52" y="74" width="48" height="4" rx="2" style={{ fill: 'var(--bg-hover)' }} />
      <rect x="52" y="82" width="30" height="4" rx="2" style={{ fill: 'var(--bg-hover)' }} />
      <circle
        cx="132"
        cy="66"
        r="14"
        style={{ fill: 'var(--brand-primary)', stroke: 'var(--bg-surface)', strokeWidth: 3 }}
      />
      <path
        d="M126 66.5l4 4 7.5-8"
        style={{
          fill: 'none',
          stroke: 'var(--text-on-brand)',
          strokeWidth: 2.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
    </svg>
  );
}

export function MyTasksEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={styles.empty}>
      <EmptyState
        illustration={<PlateIllustration />}
        title="Nothing on your plate yet"
        description="Tasks assigned to you land here, grouped by when they’re due. Create one now, or press C from anywhere."
        primaryAction={
          <Button icon="plus" onClick={onCreate}>
            Create task
          </Button>
        }
      />
      <p className={styles.tip}>
        Tip: press <Kbd keys="?" /> to see every shortcut
      </p>
    </div>
  );
}

/** When filters hide everything (but there are tasks). */
export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className={styles.empty}>
      <EmptyState
        icon="filter"
        title="No tasks match these filters"
        description="Try fewer filters, or include done tasks."
        primaryAction={
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    </div>
  );
}
