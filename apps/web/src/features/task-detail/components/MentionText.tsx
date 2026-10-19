import { Fragment } from 'react';
import type { UserRefDto } from '@hearth/contracts';
import styles from '../task-detail.module.css';

/** Highlights @mentions in comment bodies. Known people (from `mentions`) and any @word. */
export function MentionText({ body, mentions }: { body: string; mentions: readonly UserRefDto[] }) {
  const firstNames = new Map(mentions.map((m) => [m.name.split(' ')[0]!.toLowerCase(), m]));
  const parts = body.split(/(@[\p{L}\p{N}._-]+)/u);
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith('@') || part.length < 2) return <Fragment key={i}>{part}</Fragment>;
        const person = firstNames.get(part.slice(1).toLowerCase());
        return (
          <span key={i} className={styles.mention} title={person?.name}>
            {part}
          </span>
        );
      })}
    </>
  );
}
