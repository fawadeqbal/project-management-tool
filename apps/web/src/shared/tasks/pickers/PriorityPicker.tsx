import { PriorityIcon, toUiPriority } from '@hearth/ui';
import { PRIORITIES, PRIORITY_META, type Priority } from '@hearth/domain';
import { PickerList } from './PickerList';
import { PropertyPopover, type PropertyPopoverProps } from './PropertyPopover';
import styles from './pickers.module.css';

export interface PriorityPickerProps extends Omit<PropertyPopoverProps, 'label' | 'children'> {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export function PriorityPicker({ value, onChange, onOpenChange, ...popover }: PriorityPickerProps) {
  return (
    <PropertyPopover {...popover} onOpenChange={onOpenChange} label="Change priority">
      <PickerList
        label="Priority"
        numberKeys
        options={PRIORITIES.map((p, i) => ({
          id: p,
          text: PRIORITY_META[p].label,
          label: (
            <span className={styles.option}>
              <PriorityIcon level={toUiPriority(p)} labelled={false} />
              {PRIORITY_META[p].label}
            </span>
          ),
          shortcut: String(i + 1),
          selected: p === value,
        }))}
        onSelect={(id) => {
          onOpenChange(false);
          if (id !== value) onChange(id as Priority);
        }}
      />
    </PropertyPopover>
  );
}
