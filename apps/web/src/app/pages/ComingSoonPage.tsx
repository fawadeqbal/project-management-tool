import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, type IconName } from '@hearth/ui';
import styles from './pages.module.css';

/** Calm placeholder for areas that aren't built yet. */
export function ComingSoonPage({ title, icon, description }: { title: string; icon: IconName; description: string }) {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <h1 className={styles.srTitle}>{title}</h1>
      <EmptyState
        icon={icon}
        title={`${title} are on the way`}
        description={description}
        primaryAction={
          <Button icon="my-tasks" onClick={() => void navigate('/my-tasks')}>
            Go to My tasks
          </Button>
        }
      />
    </div>
  );
}

export const GoalsPage = () => (
  <ComingSoonPage title="Goals" icon="target" description="Soon you’ll connect projects to the outcomes they move. For now, track the work in projects and My tasks." />
);

export const DocsPage = () => (
  <ComingSoonPage title="Docs" icon="doc" description="Specs, briefs and meeting notes will live next to the work. Until then, keep details in task descriptions." />
);
