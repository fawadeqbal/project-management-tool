import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../internal/cx';
import { mergeRefs } from '../internal/refs';
import { type IconName } from './Icon';
import { MenuHeading, MenuItem } from './MenuItem';
import { Popover } from './Popover';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  iconColor?: string;
  shortcut?: string | readonly string[];
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface DropdownMenuSection {
  id: string;
  heading?: string;
  items: readonly DropdownMenuItem[];
}

export type DropdownMenuEntries = readonly DropdownMenuItem[] | readonly DropdownMenuSection[];

interface TriggerElementProps {
  ref?: Ref<HTMLElement>;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface DropdownMenuProps {
  /** The element that opens the menu, usually a `<Button>`. It receives ref, click/keyboard handlers and ARIA. */
  trigger: ReactElement<TriggerElementProps>;
  items: DropdownMenuEntries;
  /** Accessible name of the listbox. */
  label?: string;
  align?: 'start' | 'end';
  placement?: 'bottom' | 'top';
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Shown when there are no items. */
  emptyText?: ReactNode;
}

function isSectionList(entries: DropdownMenuEntries): entries is readonly DropdownMenuSection[] {
  const first = entries[0];
  return first !== undefined && 'items' in first;
}

function toSections(entries: DropdownMenuEntries): readonly DropdownMenuSection[] {
  if (entries.length === 0) return [];
  return isSectionList(entries) ? entries : [{ id: 'default', items: entries as readonly DropdownMenuItem[] }];
}

const TYPEAHEAD_RESET_MS = 500;

/**
 * Menu button: a trigger plus a popover listbox of MenuItems. Keyboard: ArrowDown/ArrowUp,
 * Home/End move the highlight (skipping disabled items), Enter/Space select, Esc or Tab close,
 * printable keys jump by typeahead. Focus returns to the trigger after selection.
 */
export function DropdownMenu({
  trigger,
  items,
  label,
  align = 'start',
  placement = 'bottom',
  open: openProp,
  onOpenChange,
  className,
  emptyText = 'Nothing here yet',
}: DropdownMenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const [highlight, setHighlight] = useState(-1);
  const triggerRef = useRef<HTMLElement | null>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const baseId = useId();
  const listId = `ht-menu-${baseId}`;

  const sections = useMemo(() => toSections(items), [items]);
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const optionId = (index: number) => `${listId}-opt-${index}`;

  const firstEnabled = useCallback((from: number, step: 1 | -1): number => {
    const n = flat.length;
    for (let k = 0; k < n; k += 1) {
      const i = (((from + step * k) % n) + n) % n;
      if (!flat[i]?.disabled) return i;
    }
    return -1;
  }, [flat]);

  const setOpen = useCallback(
    (next: boolean, initial: 'first' | 'last' = 'first') => {
      if (next) setHighlight(initial === 'first' ? firstEnabled(0, 1) : firstEnabled(flat.length - 1, -1));
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange, firstEnabled, flat.length],
  );

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  const select = (index: number) => {
    const item = flat[index];
    if (!item || item.disabled) return;
    close(true);
    item.onSelect();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlight((h) => firstEnabled(h + 1, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight((h) => firstEnabled((h < 0 ? 0 : h) - 1, -1));
        return;
      case 'Home':
        event.preventDefault();
        setHighlight(firstEnabled(0, 1));
        return;
      case 'End':
        event.preventDefault();
        setHighlight(firstEnabled(flat.length - 1, -1));
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(highlight);
        return;
      case 'Tab':
        close(false);
        return;
      default:
        break;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const state = typeahead.current;
      state.text = now - state.at > TYPEAHEAD_RESET_MS ? event.key.toLowerCase() : state.text + event.key.toLowerCase();
      state.at = now;
      const start = state.text.length === 1 ? highlight + 1 : Math.max(highlight, 0);
      for (let k = 0; k < flat.length; k += 1) {
        const i = (start + k) % flat.length;
        const item = flat[i];
        if (item && !item.disabled && item.label.toLowerCase().startsWith(state.text)) {
          setHighlight(i);
          break;
        }
      }
    }
  };

  if (!isValidElement(trigger)) return null;
  const triggerProps = trigger.props;
  const triggerElement = cloneElement(trigger, {
    ref: mergeRefs(triggerProps.ref, (el: HTMLElement | null) => {
      triggerRef.current = el;
    }),
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    onClick: (event: MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event);
      if (!event.defaultPrevented) setOpen(!open);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true, event.key === 'ArrowDown' ? 'first' : 'last');
      }
    },
  } as TriggerElementProps & Record<string, unknown>);

  let index = -1;
  return (
    <>
      {triggerElement}
      <Popover
        open={open}
        onOpenChange={(next) => setOpen(next)}
        anchorRef={triggerRef}
        align={align}
        placement={placement}
      >
        <div
          id={listId}
          role="listbox"
          tabIndex={0}
          aria-label={label}
          aria-activedescendant={highlight >= 0 ? optionId(highlight) : undefined}
          className={cx('ht-menu', className)}
          onKeyDown={onListKeyDown}
        >
          {flat.length === 0 ? <div className="ht-menu-empty">{emptyText}</div> : null}
          {sections.map((section) => {
            const headingId = section.heading ? `${listId}-${section.id}` : undefined;
            return (
              <div key={section.id} role="group" aria-labelledby={headingId} className="ht-menu-section">
                {section.heading ? <MenuHeading id={headingId}>{section.heading}</MenuHeading> : null}
                {section.items.map((item) => {
                  index += 1;
                  const i = index;
                  return (
                    <MenuItem
                      key={item.id}
                      id={optionId(i)}
                      label={item.label}
                      icon={item.icon}
                      iconColor={item.iconColor}
                      shortcut={item.shortcut}
                      hint={item.hint}
                      danger={item.danger}
                      disabled={item.disabled}
                      highlighted={i === highlight}
                      onMouseEnter={() => {
                        if (!item.disabled) setHighlight(i);
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => select(i)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
