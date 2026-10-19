import { type AnchorHTMLAttributes, type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement>;

/** Content for screen readers only. */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  return <span {...rest} className={cx('ht-sr-only', className)} />;
}

export interface SkipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** id of the main landmark (without #). Default "main". */
  targetId?: string;
}

/** "Skip to content" link, visible on keyboard focus. Render first in the app shell. */
export function SkipLink({
  targetId = 'main',
  children = 'Skip to content',
  className,
  ...rest
}: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} {...rest} className={cx('ht-skip', className)}>
      {children}
    </a>
  );
}
