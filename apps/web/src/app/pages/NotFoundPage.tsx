import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { Button, EmptyState } from '@hearth/ui';
import styles from './pages.module.css';

/** Friendly 404 (also the route error boundary). */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState
        icon="search"
        title="We couldn’t find that page"
        description="The link may be old, or the page was moved. Try the search, or head back to your tasks."
        primaryAction={
          <Link to="/my-tasks" className={styles.linkButton}>
            Go to My tasks
          </Link>
        }
      />
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className={styles.page}>
      <EmptyState
        icon="alert"
        title="Something went wrong on this page"
        description="It’s not you — this screen hit an error. Reload to try again; your work is saved."
        primaryAction={
          <Button icon="undo" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    </div>
  );
}
