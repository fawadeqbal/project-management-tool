import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Icon in a quiet tile. Ignored when `illustration` is given. */
  icon?: IconName;
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a primary `<Button>`. */
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  /** Heading level for the title. Default 2. */
  headingLevel?: 2 | 3 | 4;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  headingLevel = 2,
  className,
  ...rest
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx('ht-empty', className)}>
      {illustration ??
        (icon ? (
          <span className="ht-empty-art" aria-hidden="true">
            <Icon name={icon} size={20} />
          </span>
        ) : null)}
      <Heading className="ht-empty-title">{title}</Heading>
      {description ? <p className="ht-empty-desc">{description}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className="ht-empty-actions">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
