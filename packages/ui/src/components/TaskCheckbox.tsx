import { type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cx } from '../internal/cx';
import { Icon } from './Icon';

export interface TaskCheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked?: boolean;
  /** Accessible name. Default "Mark complete". */
  label?: string;
  /** Called with the next checked value. */
  onChange?: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
}

/** Round completion checkbox used on task rows. */
export function TaskCheckbox({ checked = false, label = 'Mark complete', onChange, onClick, className, ...rest }: TaskCheckboxProps) {
  return (
    <button
      type="button"
      {...rest}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cx('ht-check', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange?.(!checked, event);
      }}
    >
      <Icon name="check" size={10} strokeWidth={3.5} />
    </button>
  );
}
