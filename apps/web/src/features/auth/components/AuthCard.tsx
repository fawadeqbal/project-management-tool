import type { ReactNode } from 'react';
import styles from '../auth.module.css';

/** Centered card used by login and register. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className={styles.page} id="main">
      <div className={styles.card}>
        <div className={styles.brand} aria-hidden="true">
          <span className={styles.mark}>H</span>
          <span className={styles.wordmark}>Hearth</span>
        </div>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
        {children}
      </div>
      <p className={styles.footer}>{footer}</p>
    </main>
  );
}

/** A form-level error (not tied to one field), announced politely. */
export function FormError({ message }: { message: string | null }) {
  return (
    <div role="alert" aria-live="assertive" className={message ? styles.formError : undefined}>
      {message}
    </div>
  );
}
