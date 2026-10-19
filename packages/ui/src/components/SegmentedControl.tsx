import { type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { handleRovingKeyDown } from '../internal/roving';
import { Icon, type IconName } from './Icon';

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'role'> {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the group, e.g. "Range" or "Billing period". */
  label: string;
}

/** Single choice between a few options (radiogroup). Arrow keys move and select. */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  className,
  onKeyDown,
  ...rest
}: SegmentedControlProps) {
  const enabled = options.filter((o) => !o.disabled);
  const selectedIndex = Math.max(
    0,
    enabled.findIndex((o) => o.id === value),
  );
  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label={label}
      className={cx('ht-segmented', className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        handleRovingKeyDown(event, (index) => {
          const option = enabled[index];
          if (option && option.id !== value) onChange(option.id);
        });
      }}
    >
      {options.map((option) => {
        const checked = option.id === value;
        const rovingIndex = enabled.indexOf(option);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            data-roving-item={option.disabled ? undefined : ''}
            tabIndex={rovingIndex === selectedIndex ? 0 : -1}
            className="ht-segment"
            onClick={() => {
              if (!checked) onChange(option.id);
            }}
          >
            {option.icon ? <Icon name={option.icon} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
