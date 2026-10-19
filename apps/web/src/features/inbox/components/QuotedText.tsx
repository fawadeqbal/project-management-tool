import { Fragment } from 'react';
import styles from '../inbox.module.css';

/** Renders text with @mentions emphasized (link color + weight, never color alone). */
export function QuotedText({ text }: { text: string }) {
  const parts = text.split(/((?:^|\s)@[\p{L}\p{N}._-]+)/u);
  return (
    <>
      {parts.map((p, i) =>
        /@[\p{L}\p{N}._-]+/u.test(p) ? (
          <Fragment key={i}>
            {p.startsWith(' ') ? ' ' : ''}
            <strong className={styles.mention}>{p.trim()}</strong>
          </Fragment>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
