import { DropdownMenu, type DropdownMenuProps } from '@hearth/ui';
import type { SnoozePresetDto } from '@hearth/contracts';

export const SNOOZE_OPTIONS: { id: SnoozePresetDto; label: string; hint: string }[] = [
  { id: 'later_today', label: 'Later today', hint: 'in 3 hours' },
  { id: 'tomorrow', label: 'Tomorrow', hint: '9:00' },
  { id: 'next_week', label: 'Next week', hint: 'Mon 9:00' },
];

/** Snooze presets as a menu; the H shortcut opens it controlled from the page. */
export function SnoozeMenu({
  trigger,
  open,
  onOpenChange,
  onSnooze,
}: {
  trigger: DropdownMenuProps['trigger'];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSnooze: (preset: SnoozePresetDto) => void;
}) {
  return (
    <DropdownMenu
      label="Snooze until"
      align="end"
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      items={[{ id: 'snooze', heading: 'Snooze until', items: SNOOZE_OPTIONS.map((o) => ({ id: o.id, label: o.label, hint: o.hint, icon: 'clock' as const, onSelect: () => onSnooze(o.id) })) }]}
    />
  );
}
