import { TASK_STATUSES, STATUS_META, type TaskStatus } from '@hearth/domain';
import { PickerList } from './PickerList';
import { PropertyPopover, type PropertyPopoverProps } from './PropertyPopover';
import { STATUS_ICON } from '../meta';

export interface StatusPickerProps extends Omit<PropertyPopoverProps, 'label' | 'children'> {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
}

/** Status menu: ↑↓ Enter, or 1–5 to pick directly. */
export function StatusPicker({ value, onChange, onOpenChange, ...popover }: StatusPickerProps) {
  return (
    <PropertyPopover {...popover} onOpenChange={onOpenChange} label="Change status">
      <PickerList
        label="Status"
        numberKeys
        options={TASK_STATUSES.map((s, i) => ({
          id: s,
          text: STATUS_META[s].label,
          label: STATUS_META[s].label,
          icon: STATUS_ICON[s].icon,
          iconColor: STATUS_ICON[s].color,
          shortcut: String(i + 1),
          selected: s === value,
        }))}
        onSelect={(id) => {
          onOpenChange(false);
          if (id !== value) onChange(id as TaskStatus);
        }}
      />
    </PropertyPopover>
  );
}
