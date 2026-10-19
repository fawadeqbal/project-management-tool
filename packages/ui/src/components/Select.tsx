import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { describedBy, Field, useFieldIds, type FieldChromeProps } from './Field';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, FieldChromeProps {
  /** Options to render. Children (`<option>`) also work. */
  options?: readonly SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
}

/** Native `<select>` in Hearth field chrome. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, options, placeholder, disabled, className, style, wrapperClassName, id, children, ...rest },
  ref,
) {
  const ids = useFieldIds(id, Boolean(error || hint));
  const hasLabel = label !== undefined && label !== null;
  const control = (
    <div className={cx('ht-input', 'ht-select', error ? 'ht-input-error' : null, disabled && 'ht-input-disabled', className)} style={style}>
      <select
        ref={ref}
        id={ids.controlId}
        disabled={disabled}
        {...rest}
        aria-invalid={error ? true : rest['aria-invalid']}
        aria-describedby={describedBy(ids.messageId, rest['aria-describedby'])}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <Icon name="chevron-down" />
    </div>
  );
  if (!hasLabel && !error && !hint) return control;
  return (
    <Field ids={ids} label={label} hideLabel={hideLabel} hint={hint} error={error} className={wrapperClassName}>
      {control}
    </Field>
  );
});
