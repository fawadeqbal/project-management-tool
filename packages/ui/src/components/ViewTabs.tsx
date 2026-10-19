import { type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { handleRovingKeyDown } from '../internal/roving';
import { Icon, type IconName } from './Icon';

export interface ViewTab {
  id: string;
  label: string;
  icon?: IconName;
  /** id of the tabpanel this tab controls. */
  controls?: string;
}

export interface ViewTabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'role'> {
  tabs: readonly ViewTab[];
  value: string;
  onChange?: (id: string) => void;
  /** Accessible name of the tab list. Default "Views". */
  label?: string;
}

/**
 * Segmented view switcher with tab semantics. Roving tabindex; arrow keys, Home and End move
 * focus and activate the tab (automatic activation).
 */
export function ViewTabs({ tabs, value, onChange, label = 'Views', className, onKeyDown, ...rest }: ViewTabsProps) {
  const selectedIndex = Math.max(0, tabs.findIndex((t) => t.id === value));
  return (
    <div
      {...rest}
      role="tablist"
      aria-label={label}
      className={cx('ht-tabs', className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        handleRovingKeyDown(event, (index) => {
          const tab = tabs[index];
          if (tab && tab.id !== value) onChange?.(tab.id);
        });
      }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-roving-item=""
            className="ht-tab"
            aria-selected={selected}
            aria-controls={tab.controls}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => {
              if (!selected) onChange?.(tab.id);
            }}
          >
            {tab.icon ? <Icon name={tab.icon} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
