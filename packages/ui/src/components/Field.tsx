import { useId, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon } from './Icon';

export interface FieldChromeProps {
  /** Visible label text. Use `hideLabel` to keep it for assistive tech only. */
  label?: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Error message; marks the control invalid. */
  error?: ReactNode;
}

export interface FieldIds {
  controlId: string;
  labelId: string;
  messageId: string | undefined;
}

/** Resolves stable ids for a field's control, label and message. */
export function useFieldIds(id: string | undefined, hasMessage: boolean): FieldIds {
  const generated = useId();
  const controlId = id ?? `ht-field-${generated}`;
  return { controlId, labelId: `${controlId}-label`, messageId: hasMessage ? `${controlId}-msg` : undefined };
}

interface FieldProps extends FieldChromeProps {
  ids: FieldIds;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error layout shared by Input, Textarea and Select. */
export function Field({ ids, label, hideLabel, hint, error, className, children }: FieldProps) {
  return (
    <div className={cx('ht-field', className)}>
      {label !== undefined && label !== null ? (
        <label
          id={ids.labelId}
          htmlFor={ids.controlId}
          className={cx('ht-field-label', hideLabel && 'ht-sr-only')}
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <span id={ids.messageId} className="ht-field-msg ht-field-msg-error">
          <Icon name="alert" size={14} />
          {error}
        </span>
      ) : hint ? (
        <span id={ids.messageId} className="ht-field-msg">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function describedBy(...ids: Array<string | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined || undefined;
}
