import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMatches, useNavigate } from 'react-router-dom';
import { DropdownMenu, Icon, Kbd, MenuHeading, MenuItem, Portal } from '@hearth/ui';
import { useCommandRegistry } from '@/shared/commands/CommandsProvider';
import type { CommandContext } from '@/shared/commands/command';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useUiStore, type PaletteScope } from '@/shared/layout/ui-store';
import { useToast } from '@/shared/toast';
import { taskUrl, useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { useTaskMutations } from '@/shared/tasks/useTaskMutations';
import type { PaletteItem } from '../palette-items';
import { usePaletteData } from '../use-palette-data';
import { askHearth } from '../api';
import { Highlight } from './Highlight';
import styles from '../command-palette.module.css';

const SCOPES: { id: PaletteScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'people', label: 'People' },
  { id: 'commands', label: 'Commands' },
];

interface ItemAction {
  id: string;
  label: string;
  run: () => void;
}

/** ⌘K per Command.dc.html: search, Ask Hearth, tasks, actions, navigate, people. */
export function CommandPalette() {
  const palette = useUiStore((s) => s.palette);
  const openPalette = useUiStore((s) => s.openPalette);
  const close = useUiStore((s) => s.closePalette);
  const navigate = useNavigate();
  const matches = useMatches();
  const registry = useCommandRegistry();
  const panel = useTaskPanel();
  const mutations = useTaskMutations();
  const { show } = useToast();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PaletteScope>('all');
  const [active, setActive] = useState(0);
  const [actionsFor, setActionsFor] = useState<PaletteItem | null>(null);
  const [actionIndex, setActionIndex] = useState(0);

  useHotkey('Mod+K', () => (palette.open ? close() : openPalette()), { allowInModals: true });
  useHotkey('/', () => openPalette(), { enabled: !palette.open });

  useEffect(() => {
    if (!palette.open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQuery(palette.initialQuery);
    setScope(palette.scope);
    setActive(0);
    setActionsFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [palette.open, palette.initialQuery, palette.mode, palette.scope]);

  const ctx = (): CommandContext => ({
    navigate: (to) => void navigate(to),
    params: matches[matches.length - 1]?.params ?? {},
    selectedTaskId: useUiStore.getState().selectedTaskId,
  });
  const { groups, ms } = usePaletteData(query, scope, palette.open, ctx);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActive(0), [query, scope]);

  const dismiss = () => {
    close();
    const target = returnFocus.current;
    requestAnimationFrame(() => target?.isConnected && target.focus());
  };

  const actionsOf = (item: PaletteItem): ItemAction[] => {
    if (item.kind === 'task' && item.task) {
      const t = item.task;
      return [
        { id: 'open', label: 'Open task', run: () => panel.open(t.key) },
        { id: 'page', label: 'Open full page', run: () => void navigate(`/tasks/${t.key}`) },
        {
          id: 'complete',
          label: t.status === 'DONE' ? 'Reopen' : 'Mark as done',
          run: () => void mutations.toggleDone(t),
        },
        {
          id: 'copy',
          label: 'Copy link',
          run: () =>
            void navigator.clipboard
              .writeText(taskUrl(t.key))
              .then(() => show({ message: 'Link copied', icon: 'link', tone: 'info' }))
              .catch(() => show({ message: 'We couldn’t copy the link.', tone: 'danger' })),
        },
      ];
    }
    if (item.kind === 'person' && item.person) {
      const p = item.person;
      return [
        {
          id: 'tasks',
          label: `See ${p.name.split(' ')[0]}’s tasks`,
          run: () => void navigate(`/my-tasks?assignee=${p.id}`),
        },
      ];
    }
    return [];
  };

  const runItem = (item: PaletteItem) => {
    // Close first so focus restore doesn't fight whatever the item opens (dialogs, panels);
    // if nothing claimed focus (plain navigation), put it back where it was.
    close();
    const target = returnFocus.current;
    requestAnimationFrame(() => {
      if (document.activeElement === document.body && target?.isConnected) target.focus();
    });
    if (item.kind === 'ai' && item.href) void askHearth(query, item.href).then((to) => navigate(to));
    else if (item.kind === 'task' && item.task) panel.open(item.task.key);
    else if (item.kind === 'person' && item.href) void navigate(item.href);
    else if (item.command) void registry.run(item.command);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (actionsFor) {
      const actions = actionsOf(actionsFor);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActionIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const a = actions[actionIndex];
        close();
        a?.run();
      } else if (e.key === 'Escape' || (e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setActionsFor(null);
      } else if (e.key === 'Tab') e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[active];
      if (item) runItem(item);
    } else if (e.key === 'Tab') {
      // Tab = actions on the highlighted item (focus stays in the palette either way).
      e.preventDefault();
      const item = flat[active];
      if (item && actionsOf(item).length) {
        setActionsFor(item);
        setActionIndex(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  };

  if (!palette.open) return null;
  const activeItem = flat[active];
  const optionId = (item: PaletteItem) => `${listId}-${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  let index = -1;

  return (
    <Portal>
      <div
        className={styles.overlay}
        data-ht-layer=""
        onMouseDown={(e) => e.target === e.currentTarget && dismiss()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className={styles.dialog}
          onKeyDown={onKeyDown}
        >
          <div className={styles.inputRow}>
            <Icon
              name={palette.mode === 'ai' ? 'sparkles' : 'search'}
              size={20}
              className={styles.searchIcon}
            />
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActionsFor(null);
              }}
              placeholder={
                palette.mode === 'ai'
                  ? 'Ask Hearth, e.g. “overdue design tasks” or “urgent tasks for Sara”'
                  : 'Search or run a command…'
              }
              aria-label="Search or run a command"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeItem && !actionsFor ? optionId(activeItem) : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
            <DropdownMenu
              label="Search scope"
              align="end"
              items={SCOPES.map((s) => ({
                id: s.id,
                label: s.label,
                icon: s.id === scope ? ('check' as const) : undefined,
                onSelect: () => setScope(s.id),
              }))}
              trigger={
                <button
                  type="button"
                  className={styles.scope}
                  aria-label={`Scope: ${SCOPES.find((s) => s.id === scope)?.label}. Change scope`}
                >
                  {SCOPES.find((s) => s.id === scope)?.label}
                  <Icon name="chevron-down" />
                </button>
              }
            />
          </div>

          {actionsFor ? (
            <div
              role="listbox"
              aria-label={`Actions for ${actionsFor.prefix ?? ''} ${actionsFor.label}`}
              className={styles.list}
            >
              <MenuHeading>
                {actionsFor.prefix ? `${actionsFor.prefix} · ` : ''}
                {actionsFor.label}
              </MenuHeading>
              {actionsOf(actionsFor).map((a, i) => (
                <MenuItem
                  key={a.id}
                  label={a.label}
                  highlighted={i === actionIndex}
                  onMouseEnter={() => setActionIndex(i)}
                  onSelect={() => {
                    close();
                    a.run();
                  }}
                />
              ))}
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label="Results" className={styles.list}>
              {groups.length === 0 ? (
                <p className={styles.empty}>
                  Nothing matches “{query.trim()}”. Try fewer words, or press Esc.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.id} role="group" aria-label={g.label}>
                    <MenuHeading>{g.label}</MenuHeading>
                    {g.items.map((item) => {
                      index += 1;
                      const i = index;
                      return (
                        <MenuItem
                          key={item.id}
                          id={optionId(item)}
                          icon={item.icon}
                          iconColor={item.iconColor}
                          highlighted={i === active}
                          shortcut={item.shortcut}
                          hint={item.hint}
                          onMouseMove={() => i !== active && setActive(i)}
                          onSelect={() => runItem(item)}
                          label={
                            <>
                              {item.prefix ? <span className={styles.key}>{item.prefix}</span> : null}
                              <Highlight text={item.label} indices={item.indices} />
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}

          <div className={styles.footer}>
            <span>
              <Kbd keys="↑↓" /> Navigate
            </span>
            <span>
              <Kbd keys="↵" /> Open
            </span>
            <span>
              <Kbd keys="Tab" /> Actions on item
            </span>
            <span>
              <Kbd keys="Esc" /> Close
            </span>
            <span className={styles.timing} aria-live="polite">
              {query.trim() ? `Matched locally in ${ms} ms` : ''}
            </span>
          </div>
        </div>
      </div>
    </Portal>
  );
}
