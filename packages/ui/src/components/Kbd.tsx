import { type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';

export interface KbdProps extends HTMLAttributes<HTMLSpanElement> {
  /** One key ("C") or a sequence (["G", "T"]). */
  keys: string | readonly string[];
}

/** Keyboard shortcut hint. */
export function Kbd({ keys, className, ...rest }: KbdProps) {
  const list = typeof keys === 'string' ? [keys] : keys;
  return (
    <span {...rest} className={cx('ht-kbds', className)}>
      {list.map((key, i) => (
        <kbd key={`${key}-${i}`} className="ht-kbd">
          {key}
        </kbd>
      ))}
    </span>
  );
}
