import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. Omit only when `aria-label` is given. */
  label?: ReactNode;
}

/** On/off toggle with `role="switch"`. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, label, disabled, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const controlId = id ?? `ht-switch-${generated}`;
  const button = (
    <button
      ref={ref}
      type="button"
      {...rest}
      id={controlId}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('ht-switch', label === undefined && className)}
      onClick={() => onChange(!checked)}
    >
      <span className="ht-switch-thumb" aria-hidden="true" />
    </button>
  );
  if (label === undefined) return button;
  return (
    <span className={cx('ht-switch-field', disabled && 'ht-switch-field-disabled', className)}>
      {button}
      <label htmlFor={controlId}>{label}</label>
    </span>
  );
});
