import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { useDevWarning } from '../internal/dev';
import { describedBy, Field, useFieldIds, type FieldChromeProps } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, disabled, className, style, wrapperClassName, id, rows = 3, ...rest },
  ref,
) {
  const ids = useFieldIds(id, Boolean(error || hint));
  const hasLabel = label !== undefined && label !== null;
  useDevWarning(
    !hasLabel && !rest['aria-label'] && !rest['aria-labelledby'],
    'Textarea needs a label, aria-label or aria-labelledby.',
  );
  const control = (
    <div
      className={cx('ht-input', 'ht-input-multiline', error ? 'ht-input-error' : null, disabled && 'ht-input-disabled', className)}
      style={style}
    >
      <textarea
        ref={ref}
        id={ids.controlId}
        rows={rows}
        disabled={disabled}
        {...rest}
        aria-invalid={error ? true : rest['aria-invalid']}
        aria-describedby={describedBy(ids.messageId, rest['aria-describedby'])}
      />
    </div>
  );
  if (!hasLabel && !error && !hint) return control;
  return (
    <Field ids={ids} label={label} hideLabel={hideLabel} hint={hint} error={error} className={wrapperClassName}>
      {control}
    </Field>
  );
});
