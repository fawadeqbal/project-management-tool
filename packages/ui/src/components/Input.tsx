import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { useDevWarning } from '../internal/dev';
import { describedBy, Field, useFieldIds, type FieldChromeProps } from './Field';
import { Icon, type IconName } from './Icon';
import { Kbd } from './Kbd';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldChromeProps {
  /** Leading icon inside the field. */
  icon?: IconName;
  /** Shortcut hint shown at the end of the field, e.g. "/" or ["Ctrl", "K"]. */
  shortcut?: string | readonly string[];
  /** Class for the outer field wrapper. `className` goes on the input chrome. */
  wrapperClassName?: string;
  inputClassName?: string;
  inputStyle?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, icon, shortcut, disabled, className, style, wrapperClassName, inputClassName, inputStyle, id, ...rest },
  ref,
) {
  const ids = useFieldIds(id, Boolean(error || hint));
  const hasLabel = label !== undefined && label !== null;
  useDevWarning(
    !hasLabel && !rest['aria-label'] && !rest['aria-labelledby'],
    'Input needs a label, aria-label or aria-labelledby.',
  );
  const control = (
    <div className={cx('ht-input', error ? 'ht-input-error' : null, disabled && 'ht-input-disabled', className)} style={style}>
      {icon ? <Icon name={icon} /> : null}
      <input
        ref={ref}
        id={ids.controlId}
        disabled={disabled}
        {...rest}
        className={inputClassName}
        style={inputStyle}
        aria-invalid={error ? true : rest['aria-invalid']}
        aria-describedby={describedBy(ids.messageId, rest['aria-describedby'])}
      />
      {shortcut ? <Kbd keys={shortcut} aria-hidden="true" /> : null}
    </div>
  );
  if (!hasLabel && !error && !hint) return control;
  return (
    <Field ids={ids} label={label} hideLabel={hideLabel} hint={hint} error={error} className={wrapperClassName}>
      {control}
    </Field>
  );
});
