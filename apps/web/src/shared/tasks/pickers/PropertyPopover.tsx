import type { ReactNode, RefObject } from 'react';
import { Popover, type PopoverTriggerProps } from '@hearth/ui';

export interface PropertyPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Position against an existing element (a focused row) … */
  anchorRef?: RefObject<HTMLElement | null>;
  /** … or render a trigger button. */
  renderTrigger?: (props: PopoverTriggerProps) => ReactNode;
  label: string;
  align?: 'start' | 'end' | 'center';
  children: ReactNode;
}

/** The popover shell every property picker shares. */
export function PropertyPopover({ open, onOpenChange, anchorRef, renderTrigger, label, align = 'start', children }: PropertyPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} renderTrigger={renderTrigger} align={align} aria-label={label} role="dialog">
      {children}
    </Popover>
  );
}

export type { PopoverTriggerProps };
