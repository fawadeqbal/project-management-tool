import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MenuItem, type IconName } from '@hearth/ui';
import styles from './pickers.module.css';

export interface PickerOption {
  id: string;
  label: ReactNode;
  /** Plain text used for filtering and the accessible name. */
  text: string;
  icon?: IconName;
  iconColor?: string;
  hint?: ReactNode;
  shortcut?: string;
  selected?: boolean;
}

export interface PickerListProps {
  label: string;
  options: readonly PickerOption[];
  onSelect: (id: string) => void;
  /** Show a filter field (assignees, tags). */
  searchable?: boolean;
  placeholder?: string;
  emptyText?: string;
  /** Rendered when the filter has text and nothing matches (e.g. "Create tag “x”"). */
  onCreate?: (text: string) => void;
  createLabel?: (text: string) => string;
  /** Number keys 1–9 pick the nth option (status/priority). */
  numberKeys?: boolean;
}

/**
 * A listbox with optional filter: ↑↓ move, Enter picks, typing filters. Shared by every task
 * property picker so they all behave the same way.
 */
export function PickerList({
  label,
  options,
  onSelect,
  searchable = false,
  placeholder = 'Filter…',
  emptyText = 'Nothing matches.',
  onCreate,
  createLabel = (t) => `Create “${t}”`,
  numberKeys = false,
}: PickerListProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.text.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const showCreate = !!onCreate && query.trim().length > 0 && !options.some((o) => o.text.toLowerCase() === query.trim().toLowerCase());
  const total = filtered.length + (showCreate ? 1 : 0);
  const initial = Math.max(0, filtered.findIndex((o) => o.selected));
  const [active, setActive] = useState(initial);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive((a) => (total === 0 ? 0 : Math.min(a, total - 1)));
  }, [total]);

  useEffect(() => {
    if (!searchable) containerRef.current?.focus();
  }, [searchable]);

  useEffect(() => {
    containerRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const choose = (index: number) => {
    if (index < filtered.length) onSelect(filtered[index]!.id);
    else if (showCreate) onCreate?.(query.trim());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, total - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (total) choose(active);
    } else if (numberKeys && /^[1-9]$/.test(e.key) && !searchable) {
      const i = Number(e.key) - 1;
      if (i < filtered.length) {
        e.preventDefault();
        choose(i);
      }
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className={styles.picker} onKeyDown={searchable ? undefined : onKeyDown} ref={containerRef} tabIndex={searchable ? undefined : -1} aria-label={label}>
      {searchable ? (
        <input
          className={styles.search}
          value={query}
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={total ? optionId(active) : undefined}
          aria-autocomplete="list"
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
      ) : null}
      <div
        id={listId}
        role="listbox"
        aria-label={label}
        className={styles.list}
        aria-activedescendant={!searchable && total ? optionId(active) : undefined}
      >
        {filtered.map((o, i) => (
          <MenuItem
            key={o.id}
            id={optionId(i)}
            data-index={i}
            label={o.label}
            icon={o.icon}
            iconColor={o.iconColor}
            hint={o.hint}
            shortcut={o.shortcut}
            highlighted={i === active}
            aria-checked={o.selected ? true : undefined}
            className={o.selected ? styles.selected : undefined}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onSelect={() => choose(i)}
          />
        ))}
        {showCreate ? (
          <MenuItem
            id={optionId(filtered.length)}
            data-index={filtered.length}
            icon="plus"
            label={createLabel(query.trim())}
            highlighted={active === filtered.length}
            onMouseEnter={() => setActive(filtered.length)}
            onMouseDown={(e) => e.preventDefault()}
            onSelect={() => choose(filtered.length)}
          />
        ) : null}
        {total === 0 ? <p className={styles.empty}>{emptyText}</p> : null}
      </div>
    </div>
  );
}
